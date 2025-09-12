'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, Terminal } from 'lucide-react';
import Link from 'next/link';

export default function HelpPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center mb-6">
        <Button variant="ghost" asChild>
          <Link href="/cashier" className="flex items-center gap-2">
            <ArrowLeft size={16} />
            Kembali ke Kasir
          </Link>
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Bantuan Kasir</CardTitle>
          <CardDescription>
            Panduan untuk mengatasi masalah umum pada aplikasi kasir
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>
                Pembayaran berhasil tetapi status masih pending
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <p>
                    Jika pembayaran sudah berhasil tetapi status transaksi di aplikasi masih menunjukkan "pending",
                    ini biasanya terjadi karena notifikasi pembayaran tidak berhasil memperbarui status transaksi di database.
                  </p>
                  
                  <h4 className="font-semibold text-lg">Langkah-langkah penyelesaian:</h4>
                  
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>
                      <strong>Periksa status transaksi di dashboard penyedia pembayaran</strong>
                      <p className="text-sm text-gray-600 mt-1">
                        Pastikan status transaksi di dashboard penyedia pembayaran memang sudah berhasil.
                      </p>
                    </li>
                    
                    <li>
                      <strong>Catat ID transaksi</strong>
                      <p className="text-sm text-gray-600 mt-1">
                        ID transaksi dapat dilihat di URL halaman detail transaksi atau di riwayat transaksi.
                      </p>
                    </li>
                    
                    <li>
                      <strong>Hubungi administrator sistem</strong>
                      <p className="text-sm text-gray-600 mt-1">
                        Berikan ID transaksi kepada administrator sistem untuk memperbarui status transaksi secara manual.
                      </p>
                    </li>
                  </ol>
                  
                  <div className="bg-amber-50 p-4 rounded-md border border-amber-200">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Terminal size={16} />
                      Untuk Administrator Sistem
                    </h4>
                    <p className="text-sm mt-2">
                      Administrator dapat menjalankan script berikut untuk memeriksa status transaksi:
                    </p>
                    <pre className="bg-gray-800 text-gray-100 p-3 rounded-md text-xs mt-2 overflow-x-auto">
                      node scripts/check-transaction-status.js &lt;transaction_id&gt;
                    </pre>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-2">
              <AccordionTrigger>
                Cara membatalkan transaksi
              </AccordionTrigger>
              <AccordionContent>
                <p>
                  Untuk membatalkan transaksi yang belum dibayar, klik tombol "Batalkan" pada halaman detail transaksi.
                  Transaksi yang sudah dibayar tidak dapat dibatalkan secara langsung, hubungi administrator sistem untuk bantuan.
                </p>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-3">
              <AccordionTrigger>
                Cara mencetak struk
              </AccordionTrigger>
              <AccordionContent>
                <p>
                  Untuk mencetak struk, buka halaman detail transaksi dan klik tombol "Cetak Struk".
                  Pastikan printer sudah terhubung dan diatur dengan benar di perangkat Anda.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}