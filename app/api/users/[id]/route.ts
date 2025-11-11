import { NextRequest, NextResponse } from 'next/server'
import db from '@/models'
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getIsActive, setIsActive, removeStatus } from '@/lib/userStatusStore'

// GET /api/users/[id] - Get a specific user
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check authentication and authorization
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN can access user details, or users can access their own details
    if (session.user.role !== 'ADMIN' && session.user.id !== params.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const user = await db.User.findByPk(params.id, {
      attributes: ['id', 'name', 'email', 'role', 'createdAt', 'updatedAt'],
    });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const plain = (user as any).get({ plain: true })
    const isActive = await getIsActive(plain.id)
    const userWithStatus = { ...plain, isActive }

    return NextResponse.json(userWithStatus);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

// PATCH /api/users/[id] - Update a user
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check authentication and authorization
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN can update any user, or users can update their own details
    if (session.user.role !== 'ADMIN' && session.user.id !== params.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if user exists
    const existingUser = await db.User.findByPk(params.id);

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, email, password, role, isActive } = body;

    // Prepare update data
    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (email !== undefined) {
      // Check if email is already in use by another user
      if (email !== (existingUser as any).email) {
        const emailExists = await db.User.findOne({
          where: { email }
        });
        if (emailExists) {
          return NextResponse.json(
            { error: 'Email already in use' },
            { status: 400 }
          );
        }
      }
      updateData.email = email;
    }
    if (password !== undefined && password.trim() !== '') {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Only ADMIN can change roles
    if (role !== undefined && session.user.role === 'ADMIN') {
      updateData.role = role;
    }
    
    // Update user data in DB
    await db.User.update(updateData, {
      where: { id: params.id },
    });
    
    // Persist isActive separately if provided
    if (isActive !== undefined) {
      await setIsActive(params.id, !!isActive)
    }
    
    // Get updated user
    const updatedUser = await db.User.findByPk(params.id, {
      attributes: ['id', 'name', 'email', 'role', 'createdAt', 'updatedAt'],
    });

    const plain = (updatedUser as any).get({ plain: true })
    const active = await getIsActive(params.id)
    const userWithStatus = { ...plain, isActive: active }

    return NextResponse.json(userWithStatus);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - Delete a user
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check authentication and authorization
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only ADMIN can delete users
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if user exists
    const existingUser = await db.User.findByPk(params.id);

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent deleting the last admin
    if ((existingUser as any).role === 'ADMIN') {
      const adminCount = await db.User.count({
        where: { role: 'ADMIN' },
      });

      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot delete the last admin user' },
          { status: 400 }
        );
      }
    }

    // Delete user
    await db.User.destroy({
      where: { id: params.id },
    });

    // Remove status persistence
    await removeStatus(params.id)

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}