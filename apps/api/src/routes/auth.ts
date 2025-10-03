import { Hono } from 'hono';
import { z } from 'zod';
import type { AppContext } from '../index';
import { users } from '@anchor/database/schema';
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

    // Check if user exists
    const existing = await db.select().from(users).where(eq(users.email, data.email)).get();
    if (existing) {
      return c.json({ error: 'Email already registered' }, 409);
    }

    // TODO: Hash password (for now, storing plain text - will add bcrypt later)
    const newUser = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        email: data.email,
        name: data.name,
        phone: data.phone,
        role: 'family',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()
      .get();

    // TODO: Generate JWT token
    const token = `mock-token-${newUser.id}`;

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

    const user = await db.select().from(users).where(eq(users.email, data.email)).get();

    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // TODO: Verify password hash (for now, accepting any password)
    // const isValid = await bcrypt.compare(data.password, user.passwordHash);

    // TODO: Generate JWT token
    const token = `mock-token-${user.id}`;

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

    // TODO: Implement caregiver PIN verification
    // For now, return mock response
    return c.json({
      caregiver: {
        id: data.caregiverId,
        name: 'Mock Caregiver',
      },
      token: `mock-caregiver-token-${data.caregiverId}`,
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
