import { Hono } from 'hono';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { AppContext } from '../index';
import { users, caregivers, careRecipients } from '@anchor/database/schema';
import { eq } from 'drizzle-orm';

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

const caregiverPinSchema = z.object({
  caregiverId: z.string().uuid(),
  pin: z.string().length(6).regex(/^\d{6}$/),
});

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

    // Find caregiver by ID
    const caregiver = await db
      .select()
      .from(caregivers)
      .where(eq(caregivers.id, data.caregiverId))
      .get();

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

export default auth;
