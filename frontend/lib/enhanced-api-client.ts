import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { ApolloClient, InMemoryCache, from, HttpLink, split } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { RetryLink } from '@apollo/client/link/retry';

// Types
export interface ApiClientConfig {
  baseURL: string;
  wsURL: string;
  graphqlURL: string;
  graphqlWsURL?: string;
  timeout: number;
  retryAttempts: number;
  authRequired: boolean;
  enableMocking: boolean;
}

export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  status: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  statusCode: number;
}

// Enhanced API Client
export class EnhancedApiClient {
  private axiosInstance: AxiosInstance;
  private apolloClient: ApolloClient<any>;
  private config: ApiClientConfig;
  private authToken: string | null = null;
  private refreshTokenPromise: Promise<string> | null = null;

  constructor(config: ApiClientConfig) {
    this.config = config;
    this.setupAxiosInstance();
    this.setupApolloClient();
  }

  private setupAxiosInstance(): void {
    this.axiosInstance = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (config) => {
        // Add auth token if available
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken}`;
        }

        // Add request ID for tracing
        config.headers['X-Request-ID'] = this.generateRequestId();

        // Add timestamp
        config.headers['X-Timestamp'] = Date.now().toString();

        return config;
      },
      (error) => {
        return Promise.reject(this.formatError(error));
      }
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

        // Handle token refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const newToken = await this.refreshToken();
            originalRequest.headers = {
              ...originalRequest.headers,
              Authorization: `Bearer ${newToken}`,
            };
            return this.axiosInstance(originalRequest);
          } catch (refreshError) {
            this.handleAuthError();
            return Promise.reject(this.formatError(refreshError));
          }
        }

        return Promise.reject(this.formatError(error));
      }
    );
  }

  private setupApolloClient(): void {
    // HTTP Link
    const httpLink = new HttpLink({
      uri: this.config.graphqlURL,
    });

    // WebSocket Link for subscriptions
    const wsLink = this.config.graphqlWsURL
      ? new GraphQLWsLink(
          createClient({
            url: this.config.graphqlWsURL,
            connectionParams: () => ({
              authToken: this.authToken,
            }),
          })
        )
      : null;

    // Auth Link
    const authLink = setContext((_, { headers }) => {
      return {
        headers: {
          ...headers,
          authorization: this.authToken ? `Bearer ${this.authToken}` : '',
          'X-Request-ID': this.generateRequestId(),
        },
      };
    });

    // Error Link
    const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
      if (graphQLErrors) {
        graphQLErrors.forEach(({ message, locations, path }) => {
          console.error(`GraphQL Error: ${message}`, { locations, path, operation });
        });
      }

      if (networkError) {
        console.error('Network Error:', networkError);
        if ('statusCode' in networkError && networkError.statusCode === 401) {
          this.handleAuthError();
        }
      }
    });

    // Retry Link
    const retryLink = new RetryLink({
      delay: {
        initial: 300,
        max: Infinity,
        jitter: true,
      },
      attempts: {
        max: this.config.retryAttempts,
        retryIf: (error) => !!error && error.statusCode >= 500,
      },
    });

    // Combine links
    const splitLink = wsLink
      ? split(
          ({ query }) => {
            const definition = getMainDefinition(query);
            return definition.kind === 'OperationDefinition' && definition.operation === 'subscription';
          },
          wsLink,
          httpLink
        )
      : httpLink;

    this.apolloClient = new ApolloClient({
      link: from([errorLink, retryLink, authLink, splitLink]),
      cache: new InMemoryCache({
        typePolicies: {
          Agent: {
            keyFields: ['id'],
            fields: {
              performance: {
                merge: (existing, incoming) => ({ ...existing, ...incoming }),
              },
            },
          },
          Portfolio: {
            keyFields: ['address'],
            fields: {
              assets: {
                merge: false, // Replace entire array
              },
              performance: {
                merge: (existing, incoming) => ({ ...existing, ...incoming }),
              },
            },
          },
          ArbitrageOpportunity: {
            keyFields: ['id'],
          },
        },
      }),
      defaultOptions: {
        watchQuery: {
          errorPolicy: 'all',
          fetchPolicy: 'cache-first',
        },
        query: {
          errorPolicy: 'all',
          fetchPolicy: 'cache-first',
        },
      },
    });
  }

  // Authentication methods
  async authenticate(walletAddress: string, signature: string): Promise<string> {
    try {
      const response = await this.axiosInstance.post('/auth/wallet', {
        address: walletAddress,
        signature,
      });

      const { accessToken, refreshToken } = response.data;
      this.setAuthToken(accessToken);
      this.storeRefreshToken(refreshToken);

      return accessToken;
    } catch (error) {
      throw this.formatError(error);
    }
  }

  private async refreshToken(): Promise<string> {
    if (this.refreshTokenPromise) {
      return this.refreshTokenPromise;
    }

    this.refreshTokenPromise = this.performTokenRefresh();

    try {
      const token = await this.refreshTokenPromise;
      this.refreshTokenPromise = null;
      return token;
    } catch (error) {
      this.refreshTokenPromise = null;
      throw error;
    }
  }

  private async performTokenRefresh(): Promise<string> {
    const refreshToken = this.getStoredRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await this.axiosInstance.post('/auth/refresh', {
      refreshToken,
    });

    const { accessToken, refreshToken: newRefreshToken } = response.data;
    this.setAuthToken(accessToken);
    this.storeRefreshToken(newRefreshToken);

    return accessToken;
  }

  private setAuthToken(token: string): void {
    this.authToken = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth-token', token);
    }
  }

  private storeRefreshToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('refresh-token', token);
    }
  }

  private getStoredRefreshToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('refresh-token');
    }
    return null;
  }

  private handleAuthError(): void {
    this.authToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth-token');
      localStorage.removeItem('refresh-token');
      // Redirect to login or dispatch logout action
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
  }

  // API Methods
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.axiosInstance.get(url, config);
    return this.formatResponse(response);
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.axiosInstance.post(url, data, config);
    return this.formatResponse(response);
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.axiosInstance.put(url, data, config);
    return this.formatResponse(response);
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.axiosInstance.patch(url, data, config);
    return this.formatResponse(response);
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.axiosInstance.delete(url, config);
    return this.formatResponse(response);
  }

  // GraphQL methods
  getApolloClient(): ApolloClient<any> {
    return this.apolloClient;
  }

  async graphqlQuery<T = any>(query: string, variables?: any): Promise<T> {
    const result = await this.apolloClient.query({
      query,
      variables,
    });
    return result.data;
  }

  async graphqlMutation<T = any>(mutation: string, variables?: any): Promise<T> {
    const result = await this.apolloClient.mutate({
      mutation,
      variables,
    });
    return result.data;
  }

  // Utility methods
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private formatResponse<T>(response: AxiosResponse): ApiResponse<T> {
    return {
      data: response.data,
      status: response.status,
      message: response.statusText,
    };
  }

  private formatError(error: any): ApiError {
    if (error.response) {
      return {
        code: error.response.data?.code || 'API_ERROR',
        message: error.response.data?.message || error.message,
        details: error.response.data?.details,
        statusCode: error.response.status,
      };
    }

    if (error.request) {
      return {
        code: 'NETWORK_ERROR',
        message: 'Network error occurred',
        statusCode: 0,
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      statusCode: 500,
    };
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.get('/health');
      return true;
    } catch {
      return false;
    }
  }

  // Request cancellation
  createCancelToken() {
    return axios.CancelToken.source();
  }

  isCancel(error: any): boolean {
    return axios.isCancel(error);
  }

  // Cleanup
  destroy(): void {
    this.apolloClient.stop();
    this.authToken = null;
  }
}

// Default configuration
const defaultConfig: ApiClientConfig = {
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
  wsURL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
  graphqlURL: process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:3000/graphql',
  graphqlWsURL: process.env.NEXT_PUBLIC_GRAPHQL_WS_URL || 'ws://localhost:3000/graphql',
  timeout: 30000,
  retryAttempts: 3,
  authRequired: true,
  enableMocking: process.env.NEXT_PUBLIC_ENABLE_MOCK_DATA === 'true',
};

// Export singleton instance
export const apiClient = new EnhancedApiClient(defaultConfig);

// Export types and utilities
export type { ApiClientConfig, ApiResponse, PaginatedResponse, ApiError };
export default apiClient;