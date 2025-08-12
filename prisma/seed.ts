import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  try {
    // Check if users already exist
    const existingUsers = await prisma.user.count()
    
    if (existingUsers === 0) {
      // Create users only if they don't exist
      await createUsers()
    } else {
      console.log('Users already exist, skipping user creation')
    }
    
    // Add new products if they don't exist
    await addNewProducts()
    
    // Update products with images if they don't have them
    await updateProductImages()
  } catch (error) {
    console.error('Error seeding database:', error)
    throw error
  }
}

async function createUsers() {

    // Hash passwords
    const adminPassword = await bcrypt.hash('admin123', 12)
    const cashierPassword = await bcrypt.hash('kasir123', 12)

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        email: 'admin@pos.com',
        name: 'Administrator',
        password: adminPassword,
        role: 'ADMIN'
      }
    })

    // Create cashier user
    const cashier = await prisma.user.create({
      data: {
        email: 'kasir@pos.com',
        name: 'Kasir',
        password: cashierPassword,
        role: 'CASHIER'
      }
    })

    // Create sample categories
    const categories = await Promise.all([
      prisma.category.create({
        data: {
          name: 'Atasan',
          description: 'Kategori pakaian atasan seperti kemeja, kaos, blouse'
        }
      }),
      prisma.category.create({
        data: {
          name: 'Bawahan',
          description: 'Kategori pakaian bawahan seperti celana, rok, jeans'
        }
      }),
      prisma.category.create({
        data: {
          name: 'Aksesoris',
          description: 'Kategori aksesoris seperti topi, syal, ikat pinggang'
        }
      }),
      prisma.category.create({
        data: {
          name: 'Sepatu',
          description: 'Kategori sepatu dan alas kaki'
        }
      })
    ])

    // Create sample products
    await Promise.all([
      prisma.product.create({
        data: {
          name: 'Kemeja Putih',
          description: 'Kemeja putih formal lengan panjang',
          price: 150000,
          stock: 50,
          categoryId: categories[0].id,
          image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&h=300&fit=crop&crop=center',
          color: 'Putih',
          size: 'L'
        }
      }),
      prisma.product.create({
        data: {
          name: 'Kaos Polos Hitam',
          description: 'Kaos polos hitam bahan cotton combed 30s',
          price: 80000,
          stock: 100,
          categoryId: categories[0].id,
          image: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=400&h=300&fit=crop&crop=center',
          color: 'Hitam',
          size: 'M'
        }
      }),
      prisma.product.create({
        data: {
          name: 'Celana Jeans',
          description: 'Celana jeans slim fit pria',
          price: 250000,
          stock: 30,
          categoryId: categories[1].id,
          image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=300&fit=crop&crop=center',
          color: 'Biru',
          size: '32'
        }
      }),
      prisma.product.create({
        data: {
          name: 'Rok Midi Plisket',
          description: 'Rok midi plisket wanita',
          price: 180000,
          stock: 25,
          categoryId: categories[1].id,
          image: 'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=400&h=300&fit=crop&crop=center',
          color: 'Hitam',
          size: 'M'
        }
      }),
      prisma.product.create({
        data: {
          name: 'Topi Baseball',
          description: 'Topi baseball casual unisex',
          price: 75000,
          stock: 40,
          categoryId: categories[2].id,
          image: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=400&h=300&fit=crop&crop=center',
          color: 'Merah',
          size: 'All Size'
        }
      }),
      // Atasan tambahan
      prisma.product.create({
        data: {
          name: 'Blouse Floral',
          description: 'Blouse motif bunga lengan pendek',
          price: 120000,
          stock: 35,
          categoryId: categories[0].id,
          image: 'https://images.unsplash.com/photo-1564257631407-4deb1f99d992?w=400&h=300&fit=crop&crop=center',
          color: 'Multi',
          size: 'S'
        }
      }),
      prisma.product.create({
        data: {
          name: 'Kemeja Flannel',
          description: 'Kemeja flannel kotak-kotak',
          price: 185000,
          stock: 20,
          categoryId: categories[0].id,
          image: 'https://images.unsplash.com/photo-1589310243389-96a5483213a8?w=400&h=300&fit=crop&crop=center',
          color: 'Multi',
          size: 'L'
        }
      }),
      prisma.product.create({
        data: {
          name: 'Sweater Rajut',
          description: 'Sweater rajut tebal untuk musim dingin',
          price: 220000,
          stock: 18,
          categoryId: categories[0].id,
          image: 'https://images.unsplash.com/photo-1576871337622-98d48d1cf531?w=400&h=300&fit=crop&crop=center',
          color: 'Abu-abu',
          size: 'M'
        }
      }),
      prisma.product.create({
        data: {
          name: 'Hoodie Polos',
          description: 'Hoodie polos dengan kantong depan',
          price: 200000,
          stock: 22,
          categoryId: categories[0].id,
          image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=300&fit=crop&crop=center',
          color: 'Hitam',
          size: 'L'
        }
      }),
      // Bawahan tambahan
      prisma.product.create({
        data: {
          name: 'Celana Chino',
          description: 'Celana chino slim fit',
          price: 175000,
          stock: 40,
          categoryId: categories[1].id,
          image: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=400&h=300&fit=crop&crop=center',
          color: 'Khaki',
          size: '32'
        }
      }),
      prisma.product.create({
        data: {
          name: 'Rok A-Line',
          description: 'Rok A-line warna hitam',
          price: 150000,
          stock: 25,
          categoryId: categories[1].id,
          image: 'https://images.unsplash.com/photo-1577900232427-18219b8349fd?w=400&h=300&fit=crop&crop=center',
          color: 'Hitam',
          size: 'M'
        }
      }),
      prisma.product.create({
        data: {
          name: 'Celana Kulot',
          description: 'Celana kulot wanita bahan katun',
          price: 165000,
          stock: 30,
          categoryId: categories[1].id,
          image: 'https://images.unsplash.com/photo-1509551388413-e18d0ac5d495?w=400&h=300&fit=crop&crop=center',
          color: 'Coklat',
          size: 'M'
        }
      }),
      prisma.product.create({
        data: {
          name: 'Celana Pendek',
          description: 'Celana pendek casual pria',
          price: 120000,
          stock: 50,
          categoryId: categories[1].id,
          image: 'https://images.unsplash.com/photo-1565084888279-aca607ecce0c?w=400&h=300&fit=crop&crop=center',
          color: 'Navy',
          size: '30'
        }
      }),
      // Aksesoris tambahan
      prisma.product.create({
        data: {
          name: 'Syal Rajut',
          description: 'Syal rajut tebal untuk musim dingin',
          price: 85000,
          stock: 30,
          categoryId: categories[2].id,
          image: 'https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=400&h=300&fit=crop&crop=center',
          color: 'Merah',
          size: 'All Size'
        }
      }),
      prisma.product.create({
        data: {
          name: 'Ikat Pinggang Kulit',
          description: 'Ikat pinggang kulit asli dengan buckle metal',
          price: 95000,
          stock: 40,
          categoryId: categories[2].id,
          image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=300&fit=crop&crop=center',
          color: 'Coklat',
          size: 'All Size'
        }
      }),
      prisma.product.create({
        data: {
          name: 'Kacamata Fashion',
          description: 'Kacamata fashion non-resep',
          price: 120000,
          stock: 20,
          categoryId: categories[2].id,
          image: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=400&h=300&fit=crop&crop=center',
          color: 'Hitam',
          size: 'All Size'
        }
      }),
      // Sepatu
      prisma.product.create({
        data: {
          name: 'Sneakers Casual',
          description: 'Sneakers casual unisex',
          price: 350000,
          stock: 25,
          categoryId: categories[3].id,
          image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400&h=300&fit=crop&crop=center',
          color: 'Putih',
          size: '42'
        }
      }),
      prisma.product.create({
        data: {
          name: 'Sepatu Formal',
          description: 'Sepatu formal pria kulit sintetis',
          price: 280000,
          stock: 20,
          categoryId: categories[3].id,
          image: 'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?w=400&h=300&fit=crop&crop=center',
          color: 'Hitam',
          size: '43'
        }
      }),
      prisma.product.create({
        data: {
          name: 'Flat Shoes',
          description: 'Flat shoes wanita nyaman untuk sehari-hari',
          price: 200000,
          stock: 35,
          categoryId: categories[3].id,
          image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400&h=300&fit=crop&crop=center',
          color: 'Hitam',
          size: '38'
        }
      })
    ])

    console.log('Database seeded successfully!')
    console.log('Admin user: admin@pos.com / admin123')
    console.log('Cashier user: kasir@pos.com / kasir123')
}

async function addNewProducts() {
  try {
    // Get existing categories
    const categories = await prisma.category.findMany()
    if (categories.length === 0) {
      console.log('No categories found, skipping product creation')
      return
    }

    // List of new products to add
    const newProducts = [
      {
        name: 'Kemeja Denim',
        description: 'Kemeja denim unisex dengan wash ringan',
        price: 225000,
        stock: 15,
        categoryName: 'Atasan',
        image: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=400&h=300&fit=crop&crop=center',
        color: 'Biru',
        size: 'L'
      },
      {
        name: 'Blouse Satin',
        description: 'Blouse satin elegan untuk wanita',
        price: 180000,
        stock: 20,
        categoryName: 'Atasan',
        image: 'https://images.unsplash.com/photo-1551489186-cf8726f514f8?w=400&h=300&fit=crop&crop=center',
        color: 'Putih',
        size: 'M'
      },
      {
        name: 'Kaos Polo',
        description: 'Kaos polo pria berbahan katun',
        price: 120000,
        stock: 18,
        categoryName: 'Atasan',
        image: 'https://images.unsplash.com/photo-1586363104862-3a5e2ab60d99?w=400&h=300&fit=crop&crop=center',
        color: 'Navy',
        size: 'XL'
      },
      {
        name: 'Cardigan Rajut',
        description: 'Cardigan rajut wanita model panjang',
        price: 235000,
        stock: 12,
        categoryName: 'Atasan',
        image: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=400&h=300&fit=crop&crop=center',
        color: 'Cream',
        size: 'M'
      },
      {
        name: 'Celana Cargo',
        description: 'Celana cargo pria dengan banyak kantong',
        price: 210000,
        stock: 40,
        categoryName: 'Bawahan',
        image: 'https://images.unsplash.com/photo-1517438476312-10d79c077509?w=400&h=300&fit=crop&crop=center',
        color: 'Hijau',
        size: '32'
      },
      {
        name: 'Rok Panjang',
        description: 'Rok panjang wanita model A-line',
        price: 175000,
        stock: 25,
        categoryName: 'Bawahan',
        image: 'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=400&h=300&fit=crop&crop=center',
        color: 'Hitam',
        size: 'M'
      },
      {
        name: 'Celana Jogger',
        description: 'Celana jogger unisex bahan katun',
        price: 160000,
        stock: 30,
        categoryName: 'Bawahan',
        image: 'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=400&h=300&fit=crop&crop=center',
        color: 'Abu-abu',
        size: 'L'
      },
      {
        name: 'Rok Mini',
        description: 'Rok mini wanita bahan denim',
        price: 145000,
        stock: 50,
        categoryName: 'Bawahan',
        image: 'https://images.unsplash.com/photo-1592301933927-35b597393c0a?w=400&h=300&fit=crop&crop=center',
        color: 'Biru',
        size: 'S'
      },
      {
        name: 'Dompet Kulit',
        description: 'Dompet kulit asli pria',
        price: 185000,
        stock: 30,
        categoryName: 'Aksesoris',
        image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=400&h=300&fit=crop&crop=center',
        color: 'Coklat',
        size: 'All Size'
      },
      {
        name: 'Tas Selempang',
        description: 'Tas selempang wanita bahan kanvas',
        price: 165000,
        stock: 40,
        categoryName: 'Aksesoris',
        image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=400&h=300&fit=crop&crop=center',
        color: 'Hitam',
        size: 'All Size'
      },
      {
        name: 'Jam Tangan',
        description: 'Jam tangan analog unisex',
        price: 250000,
        stock: 20,
        categoryName: 'Aksesoris',
        image: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=400&h=300&fit=crop&crop=center',
        color: 'Silver',
        size: 'All Size'
      },
      {
        name: 'Sandal Jepit',
        description: 'Sandal jepit casual unisex',
        price: 75000,
        stock: 25,
        categoryName: 'Sepatu',
        image: 'https://images.unsplash.com/photo-1603487742131-4160ec999306?w=400&h=300&fit=crop&crop=center',
        color: 'Hitam',
        size: '40'
      },
      {
        name: 'Boots Kulit',
        description: 'Boots kulit pria model casual',
        price: 450000,
        stock: 20,
        categoryName: 'Sepatu',
        image: 'https://images.unsplash.com/photo-1638247025967-b4e38f787b76?w=400&h=300&fit=crop&crop=center',
        color: 'Coklat',
        size: '42'
      },
      {
        name: 'Sepatu Wedges',
        description: 'Sepatu wedges wanita bahan suede',
        price: 320000,
        stock: 35,
        categoryName: 'Sepatu',
        image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400&h=300&fit=crop&crop=center',
        color: 'Hitam',
        size: '38'
      }
    ]

    // Add products that don't exist yet
    for (const productData of newProducts) {
      const existingProduct = await prisma.product.findFirst({
        where: { name: productData.name }
      })

      if (!existingProduct) {
        const category = categories.find((c: any) => c.name === productData.categoryName)
        if (category) {
          await prisma.product.create({
            data: {
              name: productData.name,
              description: productData.description,
              price: productData.price,
              stock: productData.stock,
              categoryId: category.id,
              image: productData.image,
              color: productData.color || 'Default',
              size: productData.size || 'All Size'
            }
          })
          console.log(`Added new product: ${productData.name}`)
        }
      }
    }

    console.log('New products added successfully!')
  } catch (error) {
    console.error('Error adding new products:', error)
    throw error
  }
}

async function updateProductImages() {
  try {
    // Check if products need image updates
    const productsWithoutImages = await prisma.product.findMany({
      where: {
        OR: [
          { image: null },
          { image: '' }
        ]
      }
    })

    if (productsWithoutImages.length === 0) {
      console.log('All products already have images')
      return
    }

    // Update products with images based on their names
    const imageMap: { [key: string]: string } = {
      'Nasi Goreng': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&h=300&fit=crop&crop=center',
      'Mie Ayam': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&h=300&fit=crop&crop=center',
      'Es Teh': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&h=300&fit=crop&crop=center',
      'Kopi': 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop&crop=center',
      'Keripik': 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=400&h=300&fit=crop&crop=center',
      'Ayam Bakar': 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=400&h=300&fit=crop&crop=center',
      'Gado-gado': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400&h=300&fit=crop&crop=center',
      'Soto Ayam': 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&h=300&fit=crop&crop=center',
      'Rendang': 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&h=300&fit=crop&crop=center',
      'Jus Jeruk': 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&h=300&fit=crop&crop=center',
      'Es Campur': 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&h=300&fit=crop&crop=center',
      'Cappuccino': 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&h=300&fit=crop&crop=center',
      'Teh Tarik': 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=400&h=300&fit=crop&crop=center',
      'Pisang Goreng': 'https://images.unsplash.com/photo-1587132137056-bfbf0166836e?w=400&h=300&fit=crop&crop=center',
      'Tahu Isi': 'https://images.unsplash.com/photo-1626804475297-41608ea09aeb?w=400&h=300&fit=crop&crop=center',
      'Martabak Mini': 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop&crop=center',
      'Es Krim Vanilla': 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=300&fit=crop&crop=center',
      'Puding Coklat': 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&h=300&fit=crop&crop=center',
      'Klepon': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop&crop=center'
    }

    for (const product of productsWithoutImages) {
      const imageUrl = imageMap[product.name]
      if (imageUrl) {
        await prisma.product.update({
          where: { id: product.id },
          data: { image: imageUrl }
        })
        console.log(`Updated image for product: ${product.name}`)
      }
    }

    console.log('Product images updated successfully!')
  } catch (error) {
    console.error('Error updating product images:', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })