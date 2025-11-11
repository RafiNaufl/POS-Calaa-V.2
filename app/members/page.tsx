"use client"

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon, MagnifyingGlassIcon, PlusIcon, PencilIcon, TrashIcon, Squares2X2Icon, TableCellsIcon, FunnelIcon, ChartBarIcon } from '@heroicons/react/24/outline'
import Navbar from '@/components/Navbar'

interface Member {
  id: string
  name: string
  phone?: string
  email?: string
  points: number
  totalSpent: number
  transactionCount: number
  createdAt: string
  lastVisit?: string
}

interface MemberFormData {
  name: string
  phone: string
  email: string
  points: number
}

export default function MembersPage() {
  const router = useRouter()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [sortBy, setSortBy] = useState<'name' | 'points' | 'totalSpent' | 'createdAt'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [filterBy, setFilterBy] = useState<'all' | 'active' | 'inactive'>('all')
  
  const [formData, setFormData] = useState<MemberFormData>({
    name: '',
    phone: '',
    email: '',
    points: 0
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Calculate member statistics
  const memberStats = {
    totalMembers: members.length,
    totalPoints: members.reduce((sum, member) => sum + member.points, 0),
    totalSpent: members.reduce((sum, member) => sum + member.totalSpent, 0),
    averageSpent: members.length > 0 ? members.reduce((sum, member) => sum + member.totalSpent, 0) / members.length : 0
  }

  // Sort and filter members
  const sortedAndFilteredMembers = members
    .filter(member => {
      // Pastikan member valid sebelum melakukan filter
      if (!member || typeof member !== 'object') return false
      
      if (filterBy === 'active') return (member.transactionCount || 0) > 0
      if (filterBy === 'inactive') return (member.transactionCount || 0) === 0
      return true
    })
    .sort((a, b) => {
      // Pastikan properti yang digunakan untuk sorting ada dan valid
      let aValue: any, bValue: any
      
      switch (sortBy) {
        case 'name':
          aValue = (a.name || '').toLowerCase()
          bValue = (b.name || '').toLowerCase()
          break
        case 'points':
          aValue = a.points || 0
          bValue = b.points || 0
          break
        case 'totalSpent':
          aValue = a.totalSpent || 0
          bValue = b.totalSpent || 0
          break
        case 'createdAt':
          aValue = new Date(a.createdAt || new Date())
          bValue = new Date(b.createdAt || new Date())
          break
        default:
          aValue = (a.name || '').toLowerCase()
          bValue = (b.name || '').toLowerCase()
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10'
      })
      
      if (searchTerm) {
        params.append('search', searchTerm)
      }
      
      console.log('Fetching members with params:', params.toString())
      const response = await fetch(`/api/members?${params}`)
      const data = await response.json()
      
      console.log('API response data:', data)
      
      // Validasi data yang diterima
      if (data && Array.isArray(data.members)) {
        // Pastikan setiap member memiliki properti yang diperlukan
        const validatedMembers = data.members.map((member: any) => ({
          id: member.id || '',
          name: member.name || 'Unnamed Member',
          phone: member.phone || '',
          email: member.email || '',
          points: typeof member.points === 'number' ? member.points : parseInt(String(member.points ?? '0'), 10),
          totalSpent: typeof member.totalSpent === 'number' ? member.totalSpent : parseFloat(String(member.totalSpent ?? '0')),
          transactionCount: typeof member.transactionCount === 'number' ? member.transactionCount : parseInt(String(member.transactionCount ?? '0'), 10),
          createdAt: member.createdAt || new Date().toISOString(),
          lastVisit: member.lastVisit || null
        }))
        
        setMembers(validatedMembers)
        setTotalPages(data.pagination?.pages || 1)
      } else {
        console.error('Invalid data format received:', data)
        setMembers([])
        setTotalPages(1)
        setError('Format data tidak valid')
      }
    } catch (error) {
      console.error('Error fetching members:', error)
      setError('Gagal memuat data member')
      setMembers([])
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }, [currentPage, searchTerm])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    try {
      console.log('Searching with term:', searchTerm)
      fetchMembers()
    } catch (error) {
      console.error('Error in handleSearch:', error)
      setError('Terjadi kesalahan saat mencari member')
    }
  }

  const openModal = (member?: Member) => {
    try {
      console.log('openModal called with member:', member)
      
      if (member) {
        setEditingMember(member)
        setFormData({
          name: member.name,
          phone: member.phone || '',
          email: member.email || '',
          points: member.points
        })
      } else {
        // Explicitly set to null when adding new member
        setEditingMember(null)
        setFormData({
          name: '',
          phone: '',
          email: '',
          points: 0
        })
      }
      
      setShowModal(true)
      setError('')
      setSuccess('')
    } catch (error) {
      console.error('Error in openModal:', error)
      setError('Terjadi kesalahan saat membuka form')
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingMember(null)
    setError('')
    setSuccess('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    
    try {
      console.log('handleSubmit called, editingMember:', editingMember)
      console.log('formData:', formData)
      
      // Validasi data form
      if (!formData.name || formData.name.trim() === '') {
        setError('Nama member harus diisi')
        return
      }
      
      const url = '/api/members'
      const method = editingMember ? 'PUT' : 'POST'
      
      // Pastikan data yang dikirim valid
      const body = editingMember 
        ? { 
            id: editingMember.id, 
            name: formData.name.trim(),
            phone: formData.phone || null,
            email: formData.email || null,
            points: formData.points || 0
          }
        : { 
            name: formData.name.trim(),
            phone: formData.phone || null,
            email: formData.email || null
          }
      
      console.log('Sending request with body:', body)
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })
      
      // Tangani respons dengan lebih hati-hati
      let responseData
      try {
        responseData = await response.json()
        console.log('API response:', responseData)
      } catch (jsonError) {
        console.error('Error parsing response JSON:', jsonError)
        throw new Error('Gagal memproses respons dari server')
      }
      
      if (!response.ok) {
        throw new Error(responseData.error || 'Gagal menyimpan member')
      }
      
      setSuccess(editingMember ? 'Member berhasil diperbarui!' : 'Member berhasil ditambahkan!')
      setTimeout(() => {
        closeModal()
        fetchMembers()
      }, 1500)
    } catch (error: any) {
      console.error('Error in handleSubmit:', error)
      setError(error.message || 'Terjadi kesalahan saat menyimpan data')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus member "${name}"?`)) return
    
    try {
      const response = await fetch(`/api/members?id=${encodeURIComponent(id)}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Gagal menghapus member')
      }
      
      fetchMembers()
    } catch (error: any) {
      setError(error.message)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center space-x-4 mb-4">
            <button
              onClick={() => router.back()}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              <span>Kembali</span>
            </button>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900">Manajemen Member</h1>
          <p className="text-gray-600">Kelola data member dan poin reward</p>
        </div>
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ChartBarIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Member</p>
                <p className="text-2xl font-bold text-gray-900">{memberStats.totalMembers}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <ChartBarIcon className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Poin</p>
                <p className="text-2xl font-bold text-gray-900">{memberStats.totalPoints.toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <ChartBarIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Belanja</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(memberStats.totalSpent)}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <ChartBarIcon className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Rata-rata Belanja</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(memberStats.averageSpent)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search, Filter, and Controls */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <form onSubmit={handleSearch} className="flex space-x-2">
            <div className="relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Cari member..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              type="button"
              onClick={() => openModal()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors flex items-center space-x-2"
            >
              <PlusIcon className="w-5 h-5" />
              <span>Tambah Member</span>
            </button>
          </form>

          {/* Filter and View Controls */}
          <div className="flex items-center space-x-4">
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value as 'all' | 'active' | 'inactive')}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Semua Member</option>
              <option value="active">Member Aktif</option>
              <option value="inactive">Member Tidak Aktif</option>
            </select>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'points' | 'totalSpent' | 'createdAt')}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="name">Urutkan: Nama</option>
              <option value="points">Urutkan: Poin</option>
              <option value="totalSpent">Urutkan: Total Belanja</option>
              <option value="createdAt">Urutkan: Tanggal Bergabung</option>
            </select>
            
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              {sortOrder === 'asc' ? '↑ A-Z' : '↓ Z-A'}
            </button>
            
            <div className="flex border border-gray-300 rounded-md overflow-hidden">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-2 text-sm transition-colors ${
                  viewMode === 'table'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <TableCellsIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-2 text-sm transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Squares2X2Icon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Members Table */}
      {loading ? (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {sortedAndFilteredMembers.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <p className="text-gray-500">Belum ada member yang terdaftar.</p>
              <button
                onClick={() => openModal()}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
              >
                Tambah Member Pertama
              </button>
            </div>
          ) : (
            <>
              {viewMode === 'table' ? (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kontak</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Poin</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Belanja</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaksi</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bergabung</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sortedAndFilteredMembers.map((member) => (
                        <tr key={member.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{member.name}</div>
                              {member.lastVisit && (
                                <div className="text-sm text-gray-500">Terakhir: {formatDate(member.lastVisit)}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {member.phone && <div>{member.phone}</div>}
                              {member.email && <div className="text-gray-500">{member.email}</div>}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {member.points} poin
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(member.totalSpent)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {member.transactionCount} transaksi
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(member.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => openModal(member)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                <PencilIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(member.id, member.name)}
                                className="text-red-600 hover:text-red-900"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sortedAndFilteredMembers.map((member) => (
                    <div key={member.id} className="bg-white rounded-lg shadow p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">{member.name}</h3>
                          {member.lastVisit && (
                            <p className="text-sm text-gray-500">Terakhir: {formatDate(member.lastVisit)}</p>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => openModal(member)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(member.id, member.name)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {(member.phone || member.email) && (
                          <div>
                            {member.phone && <p className="text-sm text-gray-900">{member.phone}</p>}
                            {member.email && <p className="text-sm text-gray-600">{member.email}</p>}
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {member.points} poin
                          </span>
                          <span className="text-sm text-gray-900">{formatCurrency(member.totalSpent)}</span>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm text-gray-500">
                          <span>{member.transactionCount} transaksi</span>
                          <span>Bergabung {formatDate(member.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-6 rounded-lg shadow">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Sebelumnya
                    </button>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Selanjutnya
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Menampilkan halaman <span className="font-medium">{currentPage}</span> dari{' '}
                        <span className="font-medium">{totalPages}</span>
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <button
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Sebelumnya
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              page === currentPage
                                ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                        <button
                          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage === totalPages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Selanjutnya
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingMember ? 'Edit Member' : 'Tambah Member Baru'}
              </h3>
              
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                  {error}
                </div>
              )}
              
              {success && (
                <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-sm">
                  {success}
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    No. Handphone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                {editingMember && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Poin
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.points}
                      onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                )}
                
                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-md transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors"
                  >
                    {editingMember ? 'Perbarui' : 'Tambah'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}