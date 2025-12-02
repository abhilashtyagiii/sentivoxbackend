import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { emailService } from "../services/email";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const DEFAULT_PASSWORD = "esol123";

// Allowed email domains
const ALLOWED_DOMAINS = [
  '@esolglobal.com',
  '@esol.com',
  '@otomashen.com'
];

function validateEmailDomain(email: string): boolean {
  const emailLower = email.toLowerCase();
  return ALLOWED_DOMAINS.some(domain => emailLower.endsWith(domain));
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'recruiter', 'candidate']).default('recruiter')
});

// Hash password with bcrypt
async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

// Compare password with bcrypt
async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

// Generate JWT token
function generateToken(userId: string, email: string, role: string): string {
  return jwt.sign(
    { userId, email, role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Middleware to verify JWT
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.sentivox_token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await storage.getUser(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    (req as any).user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

// Middleware to require specific role
export function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    next();
  };
}

export function registerAuthRoutes(app: Express) {
  // Register (for admins to create users) - REQUIRES ADMIN AUTHENTICATION
  app.post("/api/auth/register", requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
    try {
      const { name, email, password, role } = registerSchema.parse(req.body);
      
      // Validate email domain
      if (!validateEmailDomain(email)) {
        return res.status(403).json({ 
          message: "Unauthorized email domain. Please use @esolglobal.com, @esol.com, or @otomashen.com" 
        });
      }

      // Check if user exists
      const existingUser = await storage.getUserByEmail(email.toLowerCase());
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Create user
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        role,
        isDefaultPassword: false
      });

      console.log(`✅ New user created: ${email} with role: ${role}`);

      res.json({
        message: "User created successfully",
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(400).json({ message: error instanceof Error ? error.message : 'Registration failed' });
    }
  });

  // Login
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      
      // Validate email domain
      if (!validateEmailDomain(email)) {
        return res.status(403).json({ 
          message: "Unauthorized email domain. Please use @esolglobal.com, @esol.com, or @otomashen.com" 
        });
      }

      // Check if user exists
      let user = await storage.getUserByEmail(email.toLowerCase());
      
      // If user doesn't exist, create them with default password (recruiter role)
      if (!user) {
        console.log(`Creating new recruiter with default password: ${email}`);
        const hashedDefaultPassword = await hashPassword(DEFAULT_PASSWORD);
        user = await storage.createUser({
          name: email.split('@')[0],
          email: email.toLowerCase(),
          password: hashedDefaultPassword,
          role: 'recruiter',
          isDefaultPassword: true
        });
        console.log(`✅ New recruiter created: ${email} with default password`);
      }
      
      // Verify password
      const isPasswordValid = await comparePassword(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Generate JWT token
      const token = generateToken(user._id, user.email, user.role);
      
      // Set cookie
      res.cookie('sentivox_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isDefaultPassword: user.isDefaultPassword
        },
        token
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(400).json({ message: error instanceof Error ? error.message : 'Login failed' });
    }
  });

  // Get current user
  app.get("/api/auth/me", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      
      const defaultPasswordHash = await hashPassword(DEFAULT_PASSWORD);
      const isDefaultPassword = user.password === defaultPasswordHash;

      res.json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isDefaultPassword: isDefaultPassword || user.isDefaultPassword
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  // Logout
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    res.clearCookie('sentivox_token');
    res.json({ message: "Logged out successfully" });
  });

  // Change password
  app.post("/api/auth/change-password", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }

      // Validate current password
      const isValid = await comparePassword(currentPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      // Validate new password
      if (newPassword.length < 8) {
        return res.status(400).json({ message: "New password must be at least 8 characters" });
      }

      // Update password
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUser(user._id, {
        password: hashedPassword,
        isDefaultPassword: false
      });

      console.log(`✅ Password changed successfully for user: ${user.email}`);

      res.json({ 
        success: true, 
        message: "Password changed successfully" 
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ message: error instanceof Error ? error.message : 'Password change failed' });
    }
  });

  // Forgot password
  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      
      // Validate email domain
      if (!validateEmailDomain(email)) {
        return res.status(403).json({ message: "Unauthorized email domain" });
      }

      // Check if user exists
      const user = await storage.getUserByEmail(email.toLowerCase());
      
      // Always return success to prevent email enumeration
      if (!user) {
        return res.json({ 
          message: "If an account exists with this email, a password reset link has been sent." 
        });
      }

      // Generate reset token (valid for 1 hour)
      const resetToken = jwt.sign(
        { userId: user._id, email: user.email, type: 'reset' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Send reset email
      await emailService.sendPasswordResetEmail(email.toLowerCase(), resetToken);
      
      res.json({ 
        message: "If an account exists with this email, a password reset link has been sent." 
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(400).json({ message: error instanceof Error ? error.message : 'Request failed' });
    }
  });

  // Reset password
  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Verify token
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      if (decoded.type !== 'reset') {
        return res.status(401).json({ message: "Invalid token type" });
      }

      // Validate password
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      // Update password
      const hashedPassword = await hashPassword(password);
      const updatedUser = await storage.updateUser(decoded.userId, {
        password: hashedPassword,
        isDefaultPassword: false
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      console.log(`✅ Password reset successfully for user: ${decoded.email}`);

      res.json({ 
        success: true, 
        message: "Password reset successfully. You can now log in with your new password." 
      });
    } catch (error) {
      console.error('Password reset error:', error);
      if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      res.status(500).json({ message: error instanceof Error ? error.message : 'Password reset failed' });
    }
  });
}
