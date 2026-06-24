import 'dotenv/config';

import { PrismaClient, Role } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

import * as bcrypt from 'bcrypt';


const adapter = new PrismaMariaDb({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'space_defenders',
  connectionLimit: 5,
});


const prisma = new PrismaClient({
  adapter,
});


async function main() {

  const adminEmail =
    process.env.ADMIN_EMAIL ?? 'admin@spacedefenders.com';


  const adminPassword =
    process.env.ADMIN_PASSWORD;


  if (!adminPassword) {
    throw new Error(
      'ADMIN_PASSWORD precisa estar definida no .env',
    );
  }


  const existingAdmin =
    await prisma.user.findUnique({
      where: {
        email: adminEmail,
      },
    });


  if (existingAdmin) {

    console.log(
      `Admin já existe (${adminEmail})`,
    );

    return;

  }


  const hashedPassword =
    await bcrypt.hash(adminPassword, 10);



  const admin =
    await prisma.user.create({

      data: {

        name: 'Admin',

        email: adminEmail,

        password: hashedPassword,

        provider: 'local',

        role: Role.ADMIN,

      },

    });


  console.log(
    `Admin criado: ${admin.email}`,
  );

}



main()

.catch((error)=>{

 console.error(error);

 process.exit(1);

})

.finally(async()=>{

 await prisma.$disconnect();

});