import { NextRequest, NextResponse } from 'next/server'
import db from '@/models'
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getIsActive, setIsActive } from '@/lib/userStatusStore'

// GET /api/users - Get all users
export async function GET(request: NextRequest) {
  try {
    // Check authentication and authorization
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN can access user list
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const users = await db.User.findAll({
      attributes: ['id', 'name', 'email', 'role', 'createdAt', 'updatedAt'],
      order: [['createdAt', 'DESC']],
    });
    
    // Return plain users with persistent isActive
    const usersWithStatus = await Promise.all(users.map(async (user: any) => {
      const plain = user.get({ plain: true })
      const isActive = await getIsActive(plain.id)
      return { ...plain, isActive }
    }))

    return NextResponse.json(usersWithStatus);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST /api/users - Create a new user
export async function POST(request: NextRequest) {
  try {
    // Check authentication and authorization
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN can create users
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, password, role } = body;
    const isActive = body.isActive !== undefined ? !!body.isActive : true;

    // Validate input
    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await db.User.findOne({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already in use' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await db.User.create({
      name,
      email,
      password: hashedPassword,
      role,
    });
    
    // Persist isActive separately
    await setIsActive((newUser as any).id, isActive)

    const plain = (newUser as any).get({ plain: true })
    const newUserWithStatus = { ...plain, isActive }

    return NextResponse.json(newUserWithStatus, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}