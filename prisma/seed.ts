import { PrismaClient } from "../generated/prisma/index.js";
import { faker } from '@faker-js/faker';


const prisma = new PrismaClient();

async function main() {
    
    await prisma.todo.createMany({
        data: Array.from({length: 25}, () => {
            return {
                title: faker.lorem.word({length: 3}),
                body: faker.lorem.words({min: 5, max: 10})
            }
        })
    });
};


main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });