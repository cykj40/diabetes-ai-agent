// Script to update null userId values in BloodSugarReading table
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateNullUserIds() {
    console.log('Starting to update null userId values...');

    try {
        // Count records with null userId
        const nullCount = await prisma.bloodSugarReading.count({
            where: {
                userId: null
            }
        });

        console.log(`Found ${nullCount} records with null userId`);

        if (nullCount > 0) {
            // Update all records with null userId
            const result = await prisma.bloodSugarReading.updateMany({
                where: {
                    userId: null
                },
                data: {
                    userId: 'default-user'
                }
            });

            console.log(`Successfully updated ${result.count} records`);
        } else {
            console.log('No records need updating');
        }
    } catch (error) {
        console.error('Error updating records:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the function
updateNullUserIds()
    .then(() => console.log('Update completed'))
    .catch(e => console.error('Script failed:', e)); 