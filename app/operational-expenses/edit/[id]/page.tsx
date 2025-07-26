'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ArrowLeft, CalendarIcon } from 'lucide-react'
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
}

export default function EditOperationalExpensePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { id: expenseId } = useParams()
  const { toast } = useToast()
  
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    category: 'FIXED',
    date: new Date(),
    description: '',
    receipt: ''
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
  
  // Fetch expense details
  useEffect(() => {
    if (session && expenseId) {
      fetchExpenseDetails()
    }
  }, [session, expenseId])
  
  const fetchExpenseDetails = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/operational-expenses/${expenseId}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          toast({
            title: 'Tidak Ditemukan',
            description: 'Biaya operasional tidak ditemukan.',
            variant: 'destructive'
          })
          router.push('/operational-expenses')
          return
        }
        throw new Error('Failed to fetch expense details')
      }
      
      const expense = await response.json()
      
      setFormData({
        name: expense.name,
        amount: expense.amount.toString(),
        category: expense.category,
        date: new Date(expense.date),
        description: expense.description || '',
        receipt: expense.receipt || ''
      })
    } catch (error) {
      console.error('Error fetching expense details:', error)
      toast({
        title: 'Error',
        description: 'Gagal mengambil detail biaya operasional.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }
  
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
      
      const response = await fetch(`/api/operational-expenses/${expenseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update expense')
      }
      
      toast({
        title: 'Biaya Diperbarui',
        description: 'Biaya operasional berhasil diperbarui.'
      })
      
      router.push(`/operational-expenses/${expenseId}`)
    } catch (error) {
      console.error('Error updating expense:', error)
      toast({
        title: 'Error',
        description: 'Gagal memperbarui biaya operasional.',
        variant: 'destructive'
      })
    } finally {
      setIsSubmitting(false)
    }
  }
  
  if (status === 'loading' || (session && session.user.role !== 'ADMIN')) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center space-x-2">
        <Button variant="outline" size="icon" onClick={() => router.push(`/operational-expenses/${expenseId}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">Edit Biaya Operasional</h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Edit Biaya Operasional</CardTitle>
          <CardDescription>
            Perbarui informasi biaya operasional
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : (
              <>
                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">Nama Biaya</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Contoh: Gaji Karyawan, Sewa Tempat"
                    required
                  />
                </div>
                
                {/* Amount */}
                <div className="space-y-2">
                  <Label htmlFor="amount">Jumlah (Rp)</Label>
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    value={formData.amount}
                    onChange={handleInputChange}
                    placeholder="Contoh: 1000000"
                    required
                  />
                </div>
                
                {/* Category */}
                <div className="space-y-2">
                  <Label htmlFor="category">Kategori</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => handleSelectChange('category', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FIXED">Tetap (Fixed)</SelectItem>
                      <SelectItem value="VARIABLE">Variabel (Variable)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Date */}
                <div className="space-y-2">
                  <Label htmlFor="date">Tanggal</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.date ? (
                          format(formData.date, 'PPP', { locale: idLocale })
                        ) : (
                          <span>Pilih tanggal</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.date}
                        onSelect={handleDateChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Deskripsi (Opsional)</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Deskripsi tambahan tentang biaya ini"
                    rows={3}
                  />
                </div>
                
                {/* Receipt URL */}
                <div className="space-y-2">
                  <Label htmlFor="receipt">URL Bukti Pembayaran (Opsional)</Label>
                  <Input
                    id="receipt"
                    name="receipt"
                    value={formData.receipt}
                    onChange={handleInputChange}
                    placeholder="https://example.com/receipt.jpg"
                  />
                </div>
              </>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => router.push(`/operational-expenses/${expenseId}`)}
              disabled={isSubmitting || isLoading}
            >
              Batal
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin mr-2 h-4 w-4 border-t-2 border-b-2 border-current rounded-full"></div>
                  Menyimpan...
                </>
              ) : 'Perbarui'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}