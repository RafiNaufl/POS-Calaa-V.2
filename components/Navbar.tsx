"use client"

import { useState } from "react"
import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Bars3Icon,
  XMarkIcon,
  UserIcon,
  ArrowRightOnRectangleIcon,
  HomeIcon,
  ShoppingCartIcon,
  CubeIcon,
  TagIcon,
  DocumentTextIcon,
  CreditCardIcon,
  UsersIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  roles: string[]
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon, roles: ['ADMIN', 'CASHIER'] },
  { name: 'Kasir', href: '/cashier', icon: CreditCardIcon, roles: ['ADMIN', 'CASHIER'] },
  { name: 'Produk', href: '/products', icon: CubeIcon, roles: ['ADMIN', 'CASHIER'] },
  { name: 'Member', href: '/members', icon: UserIcon, roles: ['CASHIER'] },
  { name: 'Transaksi', href: '/transactions', icon: ShoppingCartIcon, roles: ['ADMIN', 'CASHIER'] },
  { name: 'Laporan', href: '/reports', icon: DocumentTextIcon, roles: ['ADMIN', 'CASHIER'] },
  { name: 'Pengguna', href: '/users', icon: UsersIcon, roles: ['ADMIN'] },
]

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const { data: session } = useSession()
  const pathname = usePathname()

  if (!session) {
    return null
  }

  const userRole = session.user.role
  const filteredNavigation = navigation.filter(item => 
    item.roles.includes(userRole)
  )

  const handleSignOut = () => {
    signOut({ callbackUrl: '/login' })
  }

  return (
    <nav className="bg-gradient-to-r from-white via-blue-50 to-white shadow-xl border-b border-blue-100 sticky top-0 z-50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center h-16 px-4 sm:px-6 lg:px-8">
          {/* Logo and Navigation Links */}
          <div className="flex items-center space-x-6">
            {/* Logo */}
            <div className="flex-shrink-0">
              <Link href="/dashboard" className="flex items-center space-x-2.5 group">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all duration-300">
                  <span className="text-white font-bold text-sm">POS</span>
                </div>
                <div className="hidden sm:block">
                  <div className="flex flex-col">
                    <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent leading-tight">
                      POS System
                    </span>
                    <span className="text-xs text-gray-500 font-medium -mt-0.5">
                      Admin Panel
                    </span>
                  </div>
                </div>
              </Link>
            </div>
            
            {/* Navigation Menu */}
            <div className="hidden lg:flex items-center space-x-1">
              {filteredNavigation.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group relative flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg transform scale-105'
                        : 'text-gray-600 hover:text-blue-700 hover:bg-blue-50 hover:shadow-md hover:scale-102'
                    }`}
                  >
                    <item.icon className={`w-4 h-4 mr-2 transition-all duration-300 ${
                      isActive ? 'text-white' : 'text-gray-400 group-hover:text-blue-600'
                    }`} />
                    <span className="relative z-10">{item.name}</span>
                    {isActive && (
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg opacity-20 animate-pulse"></div>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
          
          {/* User Info and Actions */}
          <div className="hidden sm:flex items-center space-x-3">
            {/* User Profile */}
            <div className="flex items-center space-x-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-2 rounded-lg border border-blue-200 shadow-sm hover:shadow-md transition-all duration-300">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-md">
                <UserIcon className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-gray-900 truncate leading-tight">{session.user.name}</span>
                <div className="flex items-center -mt-0.5">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                    userRole === 'ADMIN' 
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' 
                      : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                  }`}>
                    {userRole}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Logout Button */}
            <button
              onClick={handleSignOut}
              className="flex items-center space-x-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 border border-gray-200 hover:border-red-300 hover:shadow-md group"
              title="Keluar dari sistem"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4 group-hover:rotate-12 transition-transform duration-300" />
              <span className="hidden md:block font-medium">Keluar</span>
            </button>
          </div>
          
          {/* Mobile menu button */}
          <div className="flex items-center sm:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 focus:outline-none transition-all duration-300 border border-gray-200 hover:border-blue-300 shadow-sm hover:shadow-md"
              aria-label="Toggle menu"
            >
              {isOpen ? (
                <XMarkIcon className="block h-5 w-5 transform rotate-180 transition-transform duration-300" />
              ) : (
                <Bars3Icon className="block h-5 w-5 transition-transform duration-300" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="sm:hidden bg-gradient-to-b from-white to-blue-50 border-t border-blue-200 shadow-2xl backdrop-blur-sm">
          {/* Mobile Navigation */}
          <div className="px-4 pt-4 pb-4 space-y-2">
            {filteredNavigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center px-4 py-4 rounded-xl text-base font-medium transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg transform scale-105'
                      : 'text-gray-600 hover:text-blue-700 hover:bg-blue-100 hover:shadow-md'
                  }`}
                  onClick={() => setIsOpen(false)}
                >
                  <item.icon className={`w-6 h-6 mr-4 transition-all duration-300 ${
                    isActive ? 'text-white' : 'text-gray-400 group-hover:text-blue-600'
                  }`} />
                  <span className="font-semibold">{item.name}</span>
                  {isActive && (
                    <div className="ml-auto w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  )}
                </Link>
              )
            })}
          </div>
          
          {/* Mobile User Info */}
          <div className="px-4 py-4 border-t border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center space-x-4 mb-4 p-3 bg-white rounded-xl shadow-sm border border-blue-100">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-md">
                <UserIcon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-base font-bold text-gray-900 truncate">{session.user.name}</div>
                <div className="text-sm text-gray-600 truncate">{session.user.email}</div>
                <div className={`inline-block text-xs font-bold px-2 py-1 rounded-full mt-1 ${
                  userRole === 'ADMIN' 
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' 
                    : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                }`}>
                  {userRole}
                </div>
              </div>
            </div>
            
            {/* Mobile Logout Button */}
            <button
              onClick={handleSignOut}
              className="flex items-center justify-center w-full px-4 py-3 rounded-xl text-base font-semibold text-gray-700 hover:text-red-600 hover:bg-red-50 transition-all duration-300 border-2 border-gray-200 hover:border-red-300 bg-white shadow-sm hover:shadow-md group"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5 mr-3 group-hover:rotate-12 transition-transform duration-300" />
              <span>Keluar dari Sistem</span>
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}