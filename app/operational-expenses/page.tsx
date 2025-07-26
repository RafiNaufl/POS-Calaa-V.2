'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { BarChart3, CalendarIcon, DollarSign, Filter, PlusIcon, Pencil, Receipt, Trash2, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'

type OperationalExpense = {
  id: string
  name: string
  amount: number
  category: string
  date: string
  description?: string
  receipt?: string
  createdBy: string
  createdAt: string
  updatedAt: string
  user?: {
    name: string
  }
  user_name?: string
}

export default function OperationalExpensesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  
  const [expenses, setExpenses] = useState<OperationalExpense[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [currentExpense, setCurrentExpense] = useState<OperationalExpense | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  
  // Form state
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    amount: '',
    category: 'FIXED',
    date: new Date(),
    description: '',
    receipt: ''
  })
  
  // Filter state
  const [filter, setFilter] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    endDate: new Date(),
    category: 'ALL'
  })
  
  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])
  
  // Redirect if not admin
  useEffect(() => {
    if (session && session.user.role !== 'ADMIN') {
      router.push('/dashboard')
      toast({
        title: 'Akses Ditolak',
        description: 'Anda tidak memiliki izin untuk mengakses halaman ini.',
        variant: 'destructive'
      })
    }
  }, [session, router, toast])
  
  // Fetch expenses
  const fetchExpenses = async () => {
    setIsLoading(true)
    try {
      const startDateParam = filter.startDate ? format(filter.startDate, 'yyyy-MM-dd') : ''
      const endDateParam = filter.endDate ? format(filter.endDate, 'yyyy-MM-dd') : ''
      
      let url = `/api/operational-expenses?startDate=${startDateParam}&endDate=${endDateParam}`
      if (filter.category && filter.category !== 'ALL') {
        url += `&category=${filter.category}`
      }
      
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to fetch expenses')
      }
      
      const data = await response.json()
      setExpenses(data.expenses)
    } catch (error) {
      console.error('Error fetching expenses:', error)
      toast({
        title: 'Error',
        description: 'Gagal mengambil data biaya operasional.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }
  
  // Initial fetch
  useEffect(() => {
    if (session) {
      fetchExpenses()
      // Reset to first page when filter changes
      setCurrentPage(1)
    }
  }, [session, filter])
  
  // Handle form input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }
  
  // Handle select change
  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }
  
  // Handle date change
  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setFormData(prev => ({ ...prev, date }))
    }
  }
  
  // Handle filter date change
  const handleFilterDateChange = (name: string, date: Date | undefined) => {
    if (date) {
      setFilter(prev => ({ ...prev, [name]: date }))
    }
  }
  
  // Handle filter category change
  const handleFilterCategoryChange = (value: string) => {
    setFilter(prev => ({ ...prev, category: value }))
  }
  
  // Reset form
  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      amount: '',
      category: 'FIXED',
      date: new Date(),
      description: '',
      receipt: ''
    })
  }
  
  // Open dialog for adding new expense
  const openAddDialog = () => {
    resetForm()
    setCurrentExpense(null)
    setIsDialogOpen(true)
  }
  
  // Open dialog for editing expense
  const openEditDialog = (expense: OperationalExpense) => {
    setCurrentExpense(expense)
    setFormData({
      id: expense.id,
      name: expense.name,
      amount: expense.amount.toString(),
      category: expense.category,
      date: new Date(expense.date),
      description: expense.description || '',
      receipt: expense.receipt || ''
    })
    setIsDialogOpen(true)
  }
  
  // Open dialog for deleting expense
  const openDeleteDialog = (expense: OperationalExpense) => {
    setCurrentExpense(expense)
    setIsDeleteDialogOpen(true)
  }
  
  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    try {
      const payload = {
        name: formData.name,
        amount: parseFloat(formData.amount),
        category: formData.category,
        date: format(formData.date, 'yyyy-MM-dd'),
        description: formData.description,
        receipt: formData.receipt
      }
      
      let response
      
      if (currentExpense) {
        // Update existing expense
        response = await fetch(`/api/operational-expenses/${currentExpense.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        })
      } else {
        // Create new expense
        response = await fetch('/api/operational-expenses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        })
      }
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save expense')
      }
      
      toast({
        title: currentExpense ? 'Biaya Diperbarui' : 'Biaya Ditambahkan',
        description: currentExpense 
          ? 'Biaya operasional berhasil diperbarui.' 
          : 'Biaya operasional baru berhasil ditambahkan.'
      })
      
      setIsDialogOpen(false)
      resetForm()
      fetchExpenses()
    } catch (error) {
      console.error('Error saving expense:', error)
      toast({
        title: 'Error',
        description: `Gagal ${currentExpense ? 'memperbarui' : 'menambahkan'} biaya operasional.`,
        variant: 'destructive'
      })
    } finally {
      setIsSubmitting(false)
    }
  }
  
  // Delete expense
  const handleDelete = async () => {
    if (!currentExpense) return
    
    setIsSubmitting(true)
    
    try {
      const response = await fetch(`/api/operational-expenses/${currentExpense.id}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete expense')
      }
      
      toast({
        title: 'Biaya Dihapus',
        description: 'Biaya operasional berhasil dihapus.'
      })
      
      setIsDeleteDialogOpen(false)
      fetchExpenses()
    } catch (error) {
      console.error('Error deleting expense:', error)
      toast({
        title: 'Error',
        description: 'Gagal menghapus biaya operasional.',
        variant: 'destructive'
      })
    } finally {
      setIsSubmitting(false)
    }
  }
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }
  
  // Format date
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd MMMM yyyy', { locale: id })
  }
  
  // Calculate total expenses
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  
  if (status === 'loading' || (session && session.user.role !== 'ADMIN')) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }
  
  // Handle page change
  const handlePageChange = (page: number) => {
    const totalPagesCount = Math.ceil(expenses.length / itemsPerPage)
    if (page < 1 || page > totalPagesCount) return
    setCurrentPage(page)
  }
  
  // Pagination logic
  const paginatedExpenses = expenses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )
  const totalPages = Math.ceil(expenses.length / itemsPerPage)

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Biaya Operasional</h1>
          <p className="text-muted-foreground mt-1">Kelola semua biaya operasional bisnis Anda</p>
        </div>
        <Button onClick={() => openAddDialog()} className="bg-primary hover:bg-primary/90 text-white shadow-sm flex items-center gap-2">
          <PlusIcon className="h-4 w-4" />
          Tambah Biaya Operasional
        </Button>
      </div>
      
      {/* Filter Card */}
      <Card className="shadow-sm hover:shadow transition-shadow duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </CardTitle>
          <CardDescription>Filter data biaya operasional</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Start Date Filter */}
            <div className="space-y-2">
              <Label htmlFor="startDate">Tanggal Mulai</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal bg-white hover:bg-gray-50 border-input"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                    {filter.startDate ? (
                      format(filter.startDate, 'PPP', { locale: id })
                    ) : (
                      <span>Pilih tanggal</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white border shadow-md rounded-md">
                  <Calendar
                    mode="single"
                    selected={filter.startDate}
                    onSelect={(date) => handleFilterDateChange('startDate', date)}
                    initialFocus
                    locale={id}
                    className="rounded-md"
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            {/* End Date Filter */}
            <div className="space-y-2">
              <Label htmlFor="endDate">Tanggal Akhir</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal bg-white hover:bg-gray-50 border-input"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                    {filter.endDate ? (
                      format(filter.endDate, 'PPP', { locale: id })
                    ) : (
                      <span>Pilih tanggal</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white border shadow-md rounded-md">
                  <Calendar
                    mode="single"
                    selected={filter.endDate}
                    onSelect={(date) => handleFilterDateChange('endDate', date)}
                    initialFocus
                    locale={id}
                    className="rounded-md"
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            {/* Category Filter */}
            <div className="space-y-2">
              <Label htmlFor="category">Kategori</Label>
              <Select
                value={filter.category}
                onValueChange={(value) => handleFilterCategoryChange(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Semua Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Kategori</SelectItem>
                  <SelectItem value="FIXED">Tetap (Fixed)</SelectItem>
                  <SelectItem value="VARIABLE">Variabel (Variable)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Summary Card */}
      <Card className="mb-6 shadow-sm hover:shadow transition-shadow duration-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center">
            <BarChart3 className="h-4 w-4 mr-2" />
            Ringkasan Biaya Operasional
          </CardTitle>
          <CardDescription>
            Periode {format(filter.startDate, 'dd MMM yyyy', { locale: id })} - {format(filter.endDate, 'dd MMM yyyy', { locale: id })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 bg-blue-50 rounded-lg border border-blue-100 shadow-sm hover:shadow transition-all duration-200 hover:translate-y-[-2px]">
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm font-medium text-blue-600">Total Biaya</div>
                <div className="p-2 bg-blue-100 rounded-full">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                </div>
              </div>
              <div className="text-2xl font-bold text-blue-700">{formatCurrency(totalExpenses)}</div>
              <div className="text-xs text-blue-600 mt-1">Semua biaya dalam periode</div>
            </div>
            
            <div className="p-5 bg-purple-50 rounded-lg border border-purple-100 shadow-sm hover:shadow transition-all duration-200 hover:translate-y-[-2px]">
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm font-medium text-purple-600">Jumlah Transaksi</div>
                <div className="p-2 bg-purple-100 rounded-full">
                  <Receipt className="h-4 w-4 text-purple-600" />
                </div>
              </div>
              <div className="text-2xl font-bold text-purple-700">{expenses.length}</div>
              <div className="text-xs text-purple-600 mt-1">Total transaksi dalam periode</div>
            </div>
            
            <div className="p-5 bg-emerald-50 rounded-lg border border-emerald-100 shadow-sm hover:shadow transition-all duration-200 hover:translate-y-[-2px]">
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm font-medium text-emerald-600">Rata-rata per Transaksi</div>
                <div className="p-2 bg-emerald-100 rounded-full">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                </div>
              </div>
              <div className="text-2xl font-bold text-emerald-700">{expenses.length > 0 ? formatCurrency(totalExpenses / expenses.length) : formatCurrency(0)}</div>
              <div className="text-xs text-emerald-600 mt-1">Rata-rata biaya per transaksi</div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Expenses Table */}
      <Card className="shadow-sm hover:shadow transition-shadow duration-200 overflow-hidden">
        <CardHeader className="pb-2 bg-muted/30">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <CardTitle>Daftar Biaya Operasional</CardTitle>
              <CardDescription>Semua biaya operasional dalam periode yang dipilih</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : expenses.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground bg-muted/10">
                <div className="mb-2">📋</div>
                <p className="font-medium">Tidak ada data biaya operasional</p>
                <p className="text-sm">Tidak ada data biaya operasional untuk periode ini.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableCaption>Daftar biaya operasional periode {format(filter.startDate, 'dd MMM yyyy', { locale: id })} - {format(filter.endDate, 'dd MMM yyyy', { locale: id })}</TableCaption>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/40">
                      <TableHead className="font-semibold">Tanggal</TableHead>
                      <TableHead className="font-semibold">Nama</TableHead>
                      <TableHead className="font-semibold">Kategori</TableHead>
                      <TableHead className="font-semibold text-right">Jumlah</TableHead>
                      <TableHead className="font-semibold">Dibuat Oleh</TableHead>
                      <TableHead className="font-semibold text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedExpenses.map((expense) => (
                      <TableRow key={expense.id} className="hover:bg-muted/5">
                        <TableCell>{formatDate(expense.date)}</TableCell>
                        <TableCell className="font-medium">{expense.name}</TableCell>
                        <TableCell>
                          <span className={cn(
                            "px-2 py-1 rounded-full text-xs font-medium",
                            expense.category === 'FIXED' ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"
                          )}>
                            {expense.category === 'FIXED' ? 'Tetap' : 'Variabel'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(expense.amount)}</TableCell>
                        <TableCell>{expense.user_name || 'Unknown'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button variant="outline" size="icon" onClick={() => openEditDialog(expense)} className="h-8 w-8">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon" onClick={() => openDeleteDialog(expense)} className="h-8 w-8 text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          
          {/* Pagination */}
          {!isLoading && expenses.length > 0 && (
            <div className="flex justify-center mt-6">
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Sebelumnya
                </Button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(page)}
                  >
                    {page}
                  </Button>
                ))}
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Selanjutnya
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white border shadow-md">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
              {currentExpense ? (
                <>
                  <Pencil className="h-5 w-5 text-primary" />
                  Edit Biaya Operasional
                </>
              ) : (
                <>
                  <PlusIcon className="h-5 w-5 text-primary" />
                  Tambah Biaya Operasional
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              {currentExpense
                ? "Ubah detail biaya operasional di bawah ini."
                : "Tambahkan biaya operasional baru ke dalam sistem."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-5 py-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="font-medium">Nama Biaya</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Contoh: Gaji Karyawan, Sewa Tempat"
                  className="border-input focus-visible:ring-primary bg-white"
                  required
                />
              </div>
              
              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount" className="font-medium">Jumlah (Rp)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    Rp
                  </span>
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    value={formData.amount}
                    onChange={handleInputChange}
                    placeholder="0"
                    className="pl-10 border-input focus-visible:ring-primary bg-white"
                    required
                  />
                </div>
              </div>
              
              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category" className="font-medium">Kategori</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => handleSelectChange('category', value)}
                >
                  <SelectTrigger className="border-input focus:ring-primary bg-white hover:bg-gray-50">
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border shadow-md">
                    <SelectItem value="FIXED" className="hover:bg-gray-50">
                      <div className="flex items-center">
                        <span className="h-2 w-2 rounded-full bg-blue-600 mr-2"></span>
                        Tetap (Fixed)
                      </div>
                    </SelectItem>
                    <SelectItem value="VARIABLE" className="hover:bg-gray-50">
                      <div className="flex items-center">
                        <span className="h-2 w-2 rounded-full bg-amber-600 mr-2"></span>
                        Variabel (Variable)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Date */}
              <div className="space-y-2">
                <Label htmlFor="date" className="font-medium">Tanggal</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal border-input bg-white hover:bg-gray-50 focus:ring-primary"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-gray-500" />
                      {formData.date ? (
                        format(formData.date, 'PPP', { locale: id })
                      ) : (
                        <span className="text-gray-500">Pilih tanggal</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-white border shadow-md rounded-md">
                    <Calendar
                      mode="single"
                      selected={formData.date}
                      onSelect={(date) => handleDateChange(date)}
                      initialFocus
                      locale={id}
                      className="rounded-md"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="font-medium">
                  Deskripsi
                  <span className="text-xs block font-normal text-gray-500">(Opsional)</span>
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Deskripsi tambahan tentang biaya ini"
                  className="border-input focus-visible:ring-primary bg-white min-h-[80px]"
                  rows={3}
                />
              </div>
              
              {/* Receipt URL */}
              <div className="space-y-2">
                <Label htmlFor="receipt" className="font-medium">
                  URL Bukti Pembayaran
                  <span className="text-xs block font-normal text-gray-500">(Opsional)</span>
                </Label>
                <div className="relative">
                  <Receipt className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    id="receipt"
                    name="receipt"
                    value={formData.receipt}
                    onChange={handleInputChange}
                    placeholder="https://example.com/receipt.jpg"
                    className="pl-10 border-input focus-visible:ring-primary bg-white"
                  />
                </div>
              </div>
            </div>
            
            <DialogFooter className="mt-6 pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)} 
                disabled={isSubmitting}
                className="bg-white hover:bg-gray-50 border-gray-300"
              >
                Batal
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="bg-primary hover:bg-primary/90"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin mr-2 h-4 w-4 border-t-2 border-b-2 border-white rounded-full"></div>
                    Menyimpan...
                  </>
                ) : currentExpense ? 'Perbarui' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl flex items-center">
              <Trash2 className="h-5 w-5 mr-2 text-destructive" />
              Konfirmasi Hapus
            </AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus biaya operasional <span className="font-medium">{currentExpense?.name}</span>? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-input" disabled={isSubmitting}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isSubmitting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isSubmitting ? (
                <>
                  <div className="animate-spin mr-2 h-4 w-4 border-t-2 border-b-2 border-white rounded-full"></div>
                  Menghapus...
                </>
              ) : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}