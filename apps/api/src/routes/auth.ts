import { Hono } from 'hono';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Resend } from 'resend';
import type { AppContext } from '../index';
import { users, caregivers, careRecipients, passwordResetTokens } from '@anchor/database/schema';
import { eq, and, gt } from 'drizzle-orm';

const auth = new Hono<AppContext>();

// Validation schemas
const signupSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Caregiver login accepts either username OR caregiverId (UUID)
const caregiverPinSchema = z.object({
  // Either username (e.g., "happy-panda-42") or UUID
  caregiverId: z.string().optional(),
  username: z.string().optional(),
  pin: z.string().length(6).regex(/^\d{6}$/),
}).refine(
  (data) => data.caregiverId || data.username,
  { message: 'Either caregiverId or username is required' }
);

// Family Signup
auth.post('/signup', async (c) => {
  try {
    const body = await c.req.json();
    const data = signupSchema.parse(body);

    const db = c.get('db');
    const env = c.env;

    // Check if user exists
    const existing = await db.select().from(users).where(eq(users.email, data.email)).get();
    if (existing) {
      return c.json({ error: 'Email already registered' }, 409);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    const newUser = await db
      .insert(users)
      .values({
        email: data.email,
        name: data.name,
        phone: data.phone,
        role: 'family_admin',
        passwordHash,
      })
      .returning()
      .get();

    // Generate JWT token
    const token = jwt.sign(
      {
        sub: newUser.id,
        email: newUser.email,
        role: newUser.role,
      },
      env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    return c.json(
      {
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
        },
        token,
      },
      201
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.errors }, 400);
    }
    console.error('Signup error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Family Login
auth.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const data = loginSchema.parse(body);

    const db = c.get('db');
    const env = c.env;

    const user = await db.select().from(users).where(eq(users.email, data.email)).get();

    if (!user || !user.passwordHash) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Verify password hash
    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Check if user is active
    if (!user.active) {
      return c.json({ error: 'Account is inactive' }, 403);
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
      },
      env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.errors }, 400);
    }
    console.error('Login error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Caregiver PIN Login
auth.post('/caregiver/login', async (c) => {
  try {
    const body = await c.req.json();
    const data = caregiverPinSchema.parse(body);

    const db = c.get('db');
    const env = c.env;

    // Find caregiver by username OR ID
    let caregiver;
    if (data.username) {
      // Login with username (e.g., "happy-panda-42")
      caregiver = await db
        .select()
        .from(caregivers)
        .where(eq(caregivers.username, data.username.toLowerCase()))
        .get();
    } else if (data.caregiverId) {
      // Login with UUID (legacy)
      caregiver = await db
        .select()
        .from(caregivers)
        .where(eq(caregivers.id, data.caregiverId))
        .get();
    }

    if (!caregiver) {
      return c.json({ error: 'Invalid caregiver ID or PIN' }, 401);
    }

    // Verify PIN
    const isValid = await bcrypt.compare(data.pin, caregiver.pinCode);
    if (!isValid) {
      return c.json({ error: 'Invalid caregiver ID or PIN' }, 401);
    }

    // Check if caregiver is active
    if (!caregiver.active) {
      return c.json({ error: 'Caregiver account is inactive' }, 403);
    }

    // Fetch care recipient details (for personalized validation)
    const careRecipient = await db
      .select()
      .from(careRecipients)
      .where(eq(careRecipients.id, caregiver.careRecipientId))
      .get();

    // Generate JWT token
    const token = jwt.sign(
      {
        caregiverId: caregiver.id,
        careRecipientId: caregiver.careRecipientId,
        name: caregiver.name,
      },
      env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    return c.json({
      caregiver: {
        id: caregiver.id,
        name: caregiver.name,
        username: caregiver.username,
        careRecipientId: caregiver.careRecipientId,
      },
      careRecipient: careRecipient ? {
        id: careRecipient.id,
        name: careRecipient.name,
        dateOfBirth: careRecipient.dateOfBirth,
        gender: careRecipient.gender,
        condition: careRecipient.condition,
      } : null,
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.errors }, 400);
    }
    console.error('Caregiver login error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Forgot Password Schema
const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

// Reset Password Schema
const resetPasswordSchema = z.object({
  token: z.string().min(32),
  password: z.string().min(8),
});

// Generate secure random token
function generateResetToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Forgot Password - sends reset email
auth.post('/forgot-password', async (c) => {
  try {
    const body = await c.req.json();
    const data = forgotPasswordSchema.parse(body);

    const db = c.get('db');
    const env = c.env;

    // Find user by email
    const user = await db.select().from(users).where(eq(users.email, data.email)).get();

    // Always return success to prevent email enumeration
    if (!user) {
      return c.json({
        success: true,
        message: 'If an account exists with this email, a reset link has been sent.',
      });
    }

    // Generate token and expiry (1 hour)
    const token = generateResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store token in database
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token,
      expiresAt,
    });

    // Send email with Resend
    const resend = new Resend(env.RESEND_API_KEY);

    // Determine frontend URL based on environment
    const frontendUrl = env.ENVIRONMENT === 'production'
      ? 'https://anchor.erniesg.workers.dev'
      : 'https://anchor-dev.erniesg.workers.dev';

    const resetUrl = `${frontendUrl}/auth/reset-password?token=${token}`;

    await resend.emails.send({
      from: 'Anchor Care <noreply@berlayar.ai>',
      to: user.email,
      subject: 'Reset Your Password - Anchor Care',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #1e40af;">Reset Your Password</h1>
          <p>Hi ${user.name},</p>
          <p>You requested to reset your password for your Anchor Care account.</p>
          <p>Click the button below to set a new password:</p>
          <p style="margin: 24px 0;">
            <a href="${resetUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Reset Password
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">Anchor Care - Caring for your loved ones</p>
        </div>
      `,
    });

    return c.json({
      success: true,
      message: 'If an account exists with this email, a reset link has been sent.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.errors }, 400);
    }
    console.error('Forgot password error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Reset Password - validates token and updates password
auth.post('/reset-password', async (c) => {
  try {
    const body = await c.req.json();
    const data = resetPasswordSchema.parse(body);

    const db = c.get('db');

    // Find valid token (not used, not expired)
    const resetToken = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, data.token),
          gt(passwordResetTokens.expiresAt, new Date())
        )
      )
      .get();

    if (!resetToken) {
      return c.json({ error: 'Invalid or expired reset token' }, 400);
    }

    if (resetToken.usedAt) {
      return c.json({ error: 'This reset link has already been used' }, 400);
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Update user password
    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, resetToken.userId));

    // Mark token as used
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, resetToken.id));

    return c.json({
      success: true,
      message: 'Password has been reset successfully. You can now login with your new password.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.errors }, 400);
    }
    console.error('Reset password error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default auth;
