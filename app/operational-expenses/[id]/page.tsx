"use client"

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
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
import { ArrowLeft, Pencil, Trash2, ExternalLink } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { apiFetch } from '@/lib/api'

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

export default function OperationalExpenseDetailPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const id = params.id as string
  
  const [expense, setExpense] = useState<OperationalExpense | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  
  // Redirect if not authenticated
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/login')
    }
  }, [authLoading, user, router])
  
  // Redirect if not admin
  useEffect(() => {
    if (authLoading) return
    if (user && user.role !== 'ADMIN') {
      router.push('/dashboard')
      toast({
        title: 'Akses Ditolak',
        description: 'Anda tidak memiliki izin untuk mengakses halaman ini.',
        variant: 'destructive'
      })
    }
  }, [authLoading, user, router, toast])
  
  // Fetch expense details
  useEffect(() => {
    if (user && id) {
      fetchExpenseDetails()
    }
  }, [user, id])
  
  const fetchExpenseDetails = async () => {
    setIsLoading(true)
    try {
      const response = await apiFetch(`/api/v1/operational-expenses/${id}`)
      
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
      
      const data = await response.json()
      setExpense(data.expense)
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
  
  // Delete expense
  const handleDelete = async () => {
    setIsSubmitting(true)
    
    try {
      const response = await apiFetch(`/api/v1/operational-expenses/${id}`, {
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
      
      router.push('/operational-expenses')
    } catch (error) {
      console.error('Error deleting expense:', error)
      toast({
        title: 'Error',
        description: 'Gagal menghapus biaya operasional.',
        variant: 'destructive'
      })
    } finally {
      setIsSubmitting(false)
      setIsDeleteDialogOpen(false)
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
    return format(new Date(dateString), 'dd MMMM yyyy', { locale: idLocale })
  }
  
  // Format datetime
  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), 'dd MMMM yyyy, HH:mm', { locale: idLocale })
  }
  
  if (authLoading || (user && user.role !== 'ADMIN')) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center space-x-2">
        <Button variant="outline" size="icon" onClick={() => router.push('/operational-expenses')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">Detail Biaya Operasional</h1>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : expense ? (
        <Card>
          <CardHeader>
            <CardTitle>{expense.name}</CardTitle>
            <CardDescription>
              ID: {expense.id}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Jumlah</h3>
                  <p className="text-2xl font-bold">{formatCurrency(expense.amount)}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Kategori</h3>
                  <div className="mt-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      expense.category === 'FIXED' ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"
                    }`}>
                      {expense.category === 'FIXED' ? 'Tetap (Fixed)' : 'Variabel (Variable)'}
                    </span>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Tanggal</h3>
                  <p className="text-base">{formatDate(expense.date)}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Deskripsi</h3>
                  <p className="text-base">{expense.description || '-'}</p>
                </div>
                
                {expense.receipt && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Bukti Pembayaran</h3>
                    <a 
                      href={expense.receipt} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center mt-1"
                    >
                      Lihat Bukti Pembayaran
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  </div>
                )}
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Dibuat Oleh</h3>
                  <p className="text-base">{expense.user?.name || 'Unknown'}</p>
                </div>
              </div>
            </div>
            
            <div className="border-t pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Dibuat Pada</h3>
                  <p className="text-base">{formatDateTime(expense.createdAt)}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Terakhir Diperbarui</h3>
                  <p className="text-base">{formatDateTime(expense.updatedAt)}</p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end space-x-2">
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Hapus
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
                  <AlertDialogDescription>
                    Apakah Anda yakin ingin menghapus biaya operasional "{expense.name}"?
                    Tindakan ini tidak dapat dibatalkan.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isSubmitting}>Batal</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin mr-2 h-4 w-4 border-t-2 border-b-2 border-current rounded-full"></div>
                        Menghapus...
                      </>
                    ) : 'Hapus'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
            <Button onClick={() => router.push(`/operational-expenses/edit/${expense.id}`)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-10">
            <div className="text-center text-muted-foreground">
              Biaya operasional tidak ditemukan.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}