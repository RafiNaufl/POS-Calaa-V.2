import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'

// Define the database user type
interface DatabaseUser {
  id: number;
  email: string;
  password: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'CASHIER';
  createdAt: Date;
  updatedAt: Date;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          // Dynamically import database models to avoid initialization issues
          const { sequelize } = require('../lib/sequelize')
          const { DataTypes } = require('sequelize')
          
          // Lazy load the User model
          const User = require('../models/user')(sequelize, DataTypes)
          
          const user = await User.findOne({
            where: {
              email: credentials.email
            }
          }) as DatabaseUser | null

          if (!user) {
            return null
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password
          )

          if (!isPasswordValid) {
            return null
          }

          // lastLogin feature has been removed

          return {
            id: user.id.toString(), // Convert to string for NextAuth
            email: user.email,
            name: user.name,
            role: user.role as 'ADMIN' | 'MANAGER' | 'CASHIER'
          }
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      }
    })
  ],
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (token && token.sub) {
        session.user.id = token.sub as string
        session.user.role = token.role as 'ADMIN' | 'CASHIER' | 'MANAGER'
      } else {
        // Handle case where token or token.sub is missing
        console.error('Missing token or token.sub in session callback')
      }
      return session
    }
  },
  pages: {
    signIn: '/login'
  },
  secret: process.env.NEXTAUTH_SECRET
}

export default authOptions