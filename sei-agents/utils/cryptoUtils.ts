import { createHash, randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from 'crypto';
import { ethers } from 'ethers';

/**
 * Error class for crypto-related operations
 */
export class CryptoError extends Error {
  constructor(message: string, public code: string, public details?: unknown) {
    super(message);
    this.name = 'CryptoError';
  }
}

/**
 * Key pair interface
 */
export interface KeyPair {
  publicKey: string;
  privateKey: string;
  address?: string;
}

/**
 * Signature interface
 */
export interface Signature {
  r: string;
  s: string;
  v: number;
  signature: string;
}

/**
 * Encryption result interface
 */
export interface EncryptionResult {
  encryptedData: string;
  iv: string;
  salt: string;
}

/**
 * Hash Functions
 */
export class HashUtils {
  /**
   * Generate SHA256 hash
   * @param data - Data to hash (string or Buffer)
   * @returns Hex string hash
   */
  static sha256(data: string | Buffer): string {
    try {
      const hash = createHash('sha256');
      hash.update(data);
      return hash.digest('hex');
    } catch (error) {
      throw new CryptoError('SHA256 hashing failed', 'HASH_ERROR', error);
    }
  }

  /**
   * Generate Keccak256 hash (Ethereum compatible)
   * @param data - Data to hash
   * @returns Hex string hash with 0x prefix
   */
  static keccak256(data: string | Buffer): string {
    try {
      const input = typeof data === 'string' ? ethers.utils.toUtf8Bytes(data) : data;
      return ethers.utils.keccak256(input);
    } catch (error) {
      throw new CryptoError('Keccak256 hashing failed', 'HASH_ERROR', error);
    }
  }

  /**
   * Generate hash of multiple values (useful for merkle trees)
   * @param values - Array of values to hash together
   * @returns Hex string hash
   */
  static hashMultiple(values: (string | Buffer)[]): string {
    try {
      const concatenated = values.map(v => 
        typeof v === 'string' ? Buffer.from(v, 'utf8') : v
      ).reduce((acc, buf) => Buffer.concat([acc, buf]), Buffer.alloc(0));
      
      return this.keccak256(concatenated);
    } catch (error) {
      throw new CryptoError('Multiple hash generation failed', 'HASH_ERROR', error);
    }
  }
}

/**
 * Key Management Utilities
 */
export class KeyUtils {
  /**
   * Generate a new key pair for Ethereum/Sei
   * @returns KeyPair object with public key, private key, and address
   */
  static generateKeyPair(): KeyPair {
    try {
      const wallet = ethers.Wallet.createRandom();
      return {
        publicKey: wallet.publicKey,
        privateKey: wallet.privateKey,
        address: wallet.address
      };
    } catch (error) {
      throw new CryptoError('Key pair generation failed', 'KEYGEN_ERROR', error);
    }
  }

  /**
   * Generate key pair from mnemonic
   * @param mnemonic - BIP39 mnemonic phrase
   * @param path - Derivation path (default: "m/44'/60'/0'/0/0")
   * @returns KeyPair object
   */
  static generateFromMnemonic(mnemonic: string, path = "m/44'/60'/0'/0/0"): KeyPair {
    try {
      const wallet = ethers.Wallet.fromMnemonic(mnemonic, path);
      return {
        publicKey: wallet.publicKey,
        privateKey: wallet.privateKey,
        address: wallet.address
      };
    } catch (error) {
      throw new CryptoError('Key generation from mnemonic failed', 'MNEMONIC_ERROR', error);
    }
  }

  /**
   * Generate key pair from private key
   * @param privateKey - Private key hex string
   * @returns KeyPair object
   */
  static generateFromPrivateKey(privateKey: string): KeyPair {
    try {
      const wallet = new ethers.Wallet(privateKey);
      return {
        publicKey: wallet.publicKey,
        privateKey: wallet.privateKey,
        address: wallet.address
      };
    } catch (error) {
      throw new CryptoError('Key generation from private key failed', 'PRIVATE_KEY_ERROR', error);
    }
  }

  /**
   * Generate a random mnemonic phrase
   * @param strength - Entropy strength (128, 160, 192, 224, 256)
   * @returns BIP39 mnemonic phrase
   */
  static generateMnemonic(strength = 256): string {
    try {
      return ethers.utils.entropyToMnemonic(ethers.utils.randomBytes(strength / 8));
    } catch (error) {
      throw new CryptoError('Mnemonic generation failed', 'MNEMONIC_ERROR', error);
    }
  }
}

/**
 * Digital Signature Utilities
 */
export class SignatureUtils {
  /**
   * Sign a message with private key
   * @param message - Message to sign
   * @param privateKey - Private key for signing
   * @returns Signature object
   */
  static async signMessage(message: string, privateKey: string): Promise<Signature> {
    try {
      const wallet = new ethers.Wallet(privateKey);
      const signature = await wallet.signMessage(message);
      const sig = ethers.utils.splitSignature(signature);
      
      return {
        r: sig.r,
        s: sig.s,
        v: sig.v,
        signature
      };
    } catch (error) {
      throw new CryptoError('Message signing failed', 'SIGNATURE_ERROR', error);
    }
  }

  /**
   * Sign a hash with private key
   * @param hash - Hash to sign (32 bytes)
   * @param privateKey - Private key for signing
   * @returns Signature object
   */
  static async signHash(hash: string, privateKey: string): Promise<Signature> {
    try {
      const wallet = new ethers.Wallet(privateKey);
      const hashBytes = ethers.utils.arrayify(hash);
      const signature = await wallet._signingKey().signDigest(hashBytes);
      
      return {
        r: signature.r,
        s: signature.s,
        v: signature.v,
        signature: ethers.utils.joinSignature(signature)
      };
    } catch (error) {
      throw new CryptoError('Hash signing failed', 'SIGNATURE_ERROR', error);
    }
  }

  /**
   * Verify message signature
   * @param message - Original message
   * @param signature - Signature to verify
   * @param address - Expected signer address
   * @returns True if signature is valid
   */
  static verifyMessage(message: string, signature: string, address: string): boolean {
    try {
      const recoveredAddress = ethers.utils.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === address.toLowerCase();
    } catch (error) {
      return false;
    }
  }

  /**
   * Recover address from message signature
   * @param message - Original message
   * @param signature - Message signature
   * @returns Recovered address
   */
  static recoverAddress(message: string, signature: string): string {
    try {
      return ethers.utils.verifyMessage(message, signature);
    } catch (error) {
      throw new CryptoError('Address recovery failed', 'RECOVERY_ERROR', error);
    }
  }

  /**
   * Create EIP-712 structured data signature
   * @param domain - EIP-712 domain
   * @param types - EIP-712 types
   * @param value - Data to sign
   * @param privateKey - Private key for signing
   * @returns Signature string
   */
  static async signTypedData(
    domain: any,
    types: any,
    value: any,
    privateKey: string
  ): Promise<string> {
    try {
      const wallet = new ethers.Wallet(privateKey);
      return await wallet._signTypedData(domain, types, value);
    } catch (error) {
      throw new CryptoError('Typed data signing failed', 'TYPED_SIGNATURE_ERROR', error);
    }
  }
}

/**
 * Encryption/Decryption Utilities
 */
export class EncryptionUtils {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32;
  private static readonly IV_LENGTH = 16;
  private static readonly SALT_LENGTH = 32;
  private static readonly TAG_LENGTH = 16;

  /**
   * Encrypt data with password
   * @param data - Data to encrypt
   * @param password - Password for encryption
   * @returns Encryption result with encrypted data, IV, and salt
   */
  static encrypt(data: string, password: string): EncryptionResult {
    try {
      const salt = randomBytes(this.SALT_LENGTH);
      const iv = randomBytes(this.IV_LENGTH);
      const key = pbkdf2Sync(password, salt, 100000, this.KEY_LENGTH, 'sha512');
      
      const cipher = createCipheriv(this.ALGORITHM, key, iv);
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      return {
        encryptedData: encrypted + tag.toString('hex'),
        iv: iv.toString('hex'),
        salt: salt.toString('hex')
      };
    } catch (error) {
      throw new CryptoError('Encryption failed', 'ENCRYPTION_ERROR', error);
    }
  }

  /**
   * Decrypt data with password
   * @param encryptionResult - Result from encrypt function
   * @param password - Password for decryption
   * @returns Decrypted data
   */
  static decrypt(encryptionResult: EncryptionResult, password: string): string {
    try {
      const { encryptedData, iv, salt } = encryptionResult;
      
      const saltBuffer = Buffer.from(salt, 'hex');
      const ivBuffer = Buffer.from(iv, 'hex');
      const key = pbkdf2Sync(password, saltBuffer, 100000, this.KEY_LENGTH, 'sha512');
      
      // Split encrypted data and auth tag
      const encryptedBuffer = Buffer.from(encryptedData, 'hex');
      const encryptedContent = encryptedBuffer.slice(0, -this.TAG_LENGTH);
      const tag = encryptedBuffer.slice(-this.TAG_LENGTH);
      
      const decipher = createDecipheriv(this.ALGORITHM, key, ivBuffer);
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(encryptedContent, undefined, 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new CryptoError('Decryption failed', 'DECRYPTION_ERROR', error);
    }
  }

  /**
   * Encrypt with public key (ECIES-like)
   * @param data - Data to encrypt
   * @param publicKey - Public key for encryption
   * @returns Encrypted data as hex string
   */
  static encryptWithPublicKey(data: string, publicKey: string): string {
    try {
      // Generate ephemeral key pair
      const ephemeral = KeyUtils.generateKeyPair();
      
      // Create shared secret using ECDH
      const sharedSecret = ethers.utils.computeHmac(
        ethers.utils.SupportedAlgorithm.sha256,
        ephemeral.privateKey + publicKey,
        data
      );
      
      // Use shared secret as encryption key
      const result = this.encrypt(data, sharedSecret);
      
      // Return ephemeral public key + encrypted data
      return JSON.stringify({
        ephemeralPublicKey: ephemeral.publicKey,
        ...result
      });
    } catch (error) {
      throw new CryptoError('Public key encryption failed', 'PK_ENCRYPTION_ERROR', error);
    }
  }
}

/**
 * Random Number Generation Utilities
 */
export class RandomUtils {
  /**
   * Generate cryptographically secure random bytes
   * @param size - Number of bytes to generate
   * @returns Random bytes as Buffer
   */
  static randomBytes(size: number): Buffer {
    try {
      return randomBytes(size);
    } catch (error) {
      throw new CryptoError('Random bytes generation failed', 'RANDOM_ERROR', error);
    }
  }

  /**
   * Generate random hex string
   * @param length - Length of hex string (in bytes)
   * @returns Random hex string
   */
  static randomHex(length: number): string {
    try {
      return '0x' + randomBytes(length).toString('hex');
    } catch (error) {
      throw new CryptoError('Random hex generation failed', 'RANDOM_ERROR', error);
    }
  }

  /**
   * Generate random number in range
   * @param min - Minimum value (inclusive)
   * @param max - Maximum value (exclusive)
   * @returns Random number in range
   */
  static randomInt(min: number, max: number): number {
    try {
      const range = max - min;
      const randomValue = randomBytes(4).readUInt32BE(0) / 0x100000000;
      return Math.floor(randomValue * range) + min;
    } catch (error) {
      throw new CryptoError('Random integer generation failed', 'RANDOM_ERROR', error);
    }
  }

  /**
   * Generate random UUID v4
   * @returns UUID string
   */
  static randomUUID(): string {
    try {
      const bytes = randomBytes(16);
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
      
      const hex = bytes.toString('hex');
      return [
        hex.substring(0, 8),
        hex.substring(8, 12),
        hex.substring(12, 16),
        hex.substring(16, 20),
        hex.substring(20, 32)
      ].join('-');
    } catch (error) {
      throw new CryptoError('UUID generation failed', 'UUID_ERROR', error);
    }
  }
}

/**
 * Address Validation Utilities
 */
export class AddressUtils {
  /**
   * Validate Ethereum address format
   * @param address - Address to validate
   * @returns True if valid Ethereum address
   */
  static isValidEthereumAddress(address: string): boolean {
    try {
      return ethers.utils.isAddress(address);
    } catch {
      return false;
    }
  }

  /**
   * Validate Sei address format (bech32 with 'sei' prefix)
   * @param address - Address to validate
   * @returns True if valid Sei address
   */
  static isValidSeiAddress(address: string): boolean {
    try {
      // Sei addresses use bech32 encoding with 'sei' prefix
      if (!address.startsWith('sei1')) {
        return false;
      }
      
      // Basic length check (Sei addresses are typically 43 characters)
      if (address.length !== 43) {
        return false;
      }
      
      // Character set validation (bech32 charset)
      const bech32Charset = /^[02-9ac-hj-np-z]+$/;
      const addressData = address.slice(4); // Remove 'sei1' prefix
      
      return bech32Charset.test(addressData);
    } catch {
      return false;
    }
  }

  /**
   * Convert Ethereum address to checksum format
   * @param address - Address to convert
   * @returns Checksummed address
   */
  static toChecksumAddress(address: string): string {
    try {
      return ethers.utils.getAddress(address);
    } catch (error) {
      throw new CryptoError('Address checksum conversion failed', 'ADDRESS_ERROR', error);
    }
  }

  /**
   * Validate if address matches expected format for given network
   * @param address - Address to validate
   * @param network - Network type ('ethereum', 'sei')
   * @returns True if valid for network
   */
  static isValidAddressForNetwork(address: string, network: 'ethereum' | 'sei'): boolean {
    switch (network) {
      case 'ethereum':
        return this.isValidEthereumAddress(address);
      case 'sei':
        return this.isValidSeiAddress(address);
      default:
        return false;
    }
  }

  /**
   * Extract public key from address (if possible)
   * @param address - Ethereum address
   * @param signature - A signature from this address
   * @param message - The message that was signed
   * @returns Public key if recoverable
   */
  static recoverPublicKey(address: string, signature: string, message: string): string {
    try {
      const recoveredAddress = SignatureUtils.recoverAddress(message, signature);
      if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        throw new Error('Address mismatch');
      }
      
      // Use ethers to recover public key
      const msgHash = ethers.utils.hashMessage(message);
      const sig = ethers.utils.splitSignature(signature);
      return ethers.utils.recoverPublicKey(msgHash, sig);
    } catch (error) {
      throw new CryptoError('Public key recovery failed', 'RECOVERY_ERROR', error);
    }
  }
}

/**
 * Utility functions for common crypto operations
 */
export class CryptoUtils {
  /**
   * Generate secure password
   * @param length - Password length
   * @param includeSymbols - Include symbols in password
   * @returns Secure password
   */
  static generateSecurePassword(length = 32, includeSymbols = true): string {
    try {
      const lowercase = 'abcdefghijklmnopqrstuvwxyz';
      const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const numbers = '0123456789';
      const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      
      let charset = lowercase + uppercase + numbers;
      if (includeSymbols) {
        charset += symbols;
      }
      
      let password = '';
      for (let i = 0; i < length; i++) {
        const randomIndex = RandomUtils.randomInt(0, charset.length);
        password += charset[randomIndex];
      }
      
      return password;
    } catch (error) {
      throw new CryptoError('Password generation failed', 'PASSWORD_ERROR', error);
    }
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   * @param a - First string
   * @param b - Second string
   * @returns True if strings are equal
   */
  static constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
  }

  /**
   * Derive deterministic key from seed
   * @param seed - Seed string
   * @param info - Additional context info
   * @param length - Desired key length
   * @returns Derived key
   */
  static deriveKey(seed: string, info: string, length = 32): Buffer {
    try {
      return pbkdf2Sync(seed, info, 100000, length, 'sha512');
    } catch (error) {
      throw new CryptoError('Key derivation failed', 'DERIVE_ERROR', error);
    }
  }

  /**
   * Create merkle tree root from array of hashes
   * @param hashes - Array of hash strings
   * @returns Merkle root hash
   */
  static createMerkleRoot(hashes: string[]): string {
    try {
      if (hashes.length === 0) {
        return HashUtils.keccak256('');
      }
      
      if (hashes.length === 1) {
        return hashes[0];
      }
      
      let currentLevel = [...hashes];
      
      while (currentLevel.length > 1) {
        const nextLevel: string[] = [];
        
        for (let i = 0; i < currentLevel.length; i += 2) {
          if (i + 1 < currentLevel.length) {
            const combined = currentLevel[i] + currentLevel[i + 1].slice(2); // Remove 0x from second hash
            nextLevel.push(HashUtils.keccak256(combined));
          } else {
            // Odd number of hashes, duplicate the last one
            const combined = currentLevel[i] + currentLevel[i].slice(2);
            nextLevel.push(HashUtils.keccak256(combined));
          }
        }
        
        currentLevel = nextLevel;
      }
      
      return currentLevel[0];
    } catch (error) {
      throw new CryptoError('Merkle root creation failed', 'MERKLE_ERROR', error);
    }
  }
}

// Default export with all utilities
export default {
  Hash: HashUtils,
  Key: KeyUtils,
  Signature: SignatureUtils,
  Encryption: EncryptionUtils,
  Random: RandomUtils,
  Address: AddressUtils,
  Utils: CryptoUtils
};