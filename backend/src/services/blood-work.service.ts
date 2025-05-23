import { PrismaClient } from '@prisma/client';

export interface BloodWorkValue {
    name: string;
    value: string | number;
    unit: string;
    normalRange?: string;
    isAbnormal?: boolean;
    category?: string;
}

export interface BloodWorkRecord {
    id: string;
    name: string;
    date: string;
    values: BloodWorkValue[];
    interpretation?: string;
    fileName?: string;
    fileType?: string;
}

export class BloodWorkService {
    private prisma: PrismaClient;

    constructor() {
        this.prisma = new PrismaClient();
    }

    /**
     * Parse CSV content and extract blood work data
     */
    async parseCSV(csvContent: string, fileName: string, userId: string = 'default-user'): Promise<BloodWorkRecord> {
        const lines = csvContent.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim());

        const values: BloodWorkValue[] = [];

        // Skip header row
        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(',').map(cell => cell.trim());
            if (row.length >= 3) {
                const name = row[0] || `Test ${i}`;
                const value = row[1];
                const unit = row[2];
                const normalRange = row[3] || undefined;

                // Simple abnormal detection
                const numValue = parseFloat(value.toString());
                let isAbnormal = false;

                if (normalRange && !isNaN(numValue)) {
                    if (normalRange.startsWith('>')) {
                        const minValue = parseFloat(normalRange.substring(1));
                        isAbnormal = numValue <= minValue;
                    } else if (normalRange.startsWith('<')) {
                        const maxValue = parseFloat(normalRange.substring(1));
                        isAbnormal = numValue >= maxValue;
                    } else if (normalRange.includes('-')) {
                        const [min, max] = normalRange.split('-').map(parseFloat);
                        isAbnormal = numValue < min || numValue > max;
                    }
                }

                // Categorize tests
                const category = this.categorizeTest(name);

                values.push({
                    name,
                    value,
                    unit,
                    normalRange,
                    isAbnormal,
                    category
                });
            }
        }

        // Save to database
        const record = await this.prisma.bloodWorkRecord.create({
            data: {
                userId,
                name: fileName.replace('.csv', '').replace(/[_-]/g, ' '),
                date: new Date(),
                fileName,
                fileType: 'csv',
                values: {
                    create: values.map(v => ({
                        name: v.name,
                        value: v.value.toString(),
                        numericValue: typeof v.value === 'number' ? v.value : parseFloat(v.value.toString()) || null,
                        unit: v.unit,
                        normalRange: v.normalRange,
                        isAbnormal: v.isAbnormal,
                        category: v.category
                    }))
                }
            },
            include: {
                values: true
            }
        });

        return this.formatRecord(record);
    }

    /**
     * Parse PDF content (basic text extraction)
     */
    async parsePDF(textContent: string, fileName: string, userId: string = 'default-user'): Promise<BloodWorkRecord> {
        // Simple PDF text parsing - look for patterns like "Test: Value Unit"
        const lines = textContent.split('\n').filter(line => line.trim());
        const values: BloodWorkValue[] = [];

        for (const line of lines) {
            // Look for patterns like "Glucose: 95 mg/dL" or "HbA1c 6.2%"
            const match = line.match(/([\w\s]+)[:]\s*(\d+\.?\d*)\s*(\w+\/?\w*)/);
            if (match) {
                const [, name, value, unit] = match;
                const category = this.categorizeTest(name.trim());

                values.push({
                    name: name.trim(),
                    value: parseFloat(value),
                    unit: unit.trim(),
                    category
                });
            }
        }

        // Save to database
        const record = await this.prisma.bloodWorkRecord.create({
            data: {
                userId,
                name: fileName.replace('.pdf', '').replace(/[_-]/g, ' '),
                date: new Date(),
                fileName,
                fileType: 'pdf',
                values: {
                    create: values.map(v => ({
                        name: v.name,
                        value: v.value.toString(),
                        numericValue: typeof v.value === 'number' ? v.value : parseFloat(v.value.toString()) || null,
                        unit: v.unit,
                        normalRange: v.normalRange,
                        isAbnormal: v.isAbnormal,
                        category: v.category
                    }))
                }
            },
            include: {
                values: true
            }
        });

        return this.formatRecord(record);
    }

    /**
     * Categorize a test based on its name
     */
    private categorizeTest(testName: string): string {
        const name = testName.toLowerCase();

        if (name.includes('glucose') || name.includes('sugar') || name.includes('hba1c') || name.includes('a1c') || name.includes('fructosamine')) {
            return 'diabetes';
        } else if (name.includes('cholesterol') || name.includes('ldl') || name.includes('hdl') || name.includes('triglyceride')) {
            return 'cholesterol';
        } else if (name.includes('creatinine') || name.includes('bun') || name.includes('kidney')) {
            return 'kidney';
        } else if (name.includes('alt') || name.includes('ast') || name.includes('liver') || name.includes('bilirubin')) {
            return 'liver';
        } else if (name.includes('thyroid') || name.includes('tsh') || name.includes('t3') || name.includes('t4')) {
            return 'thyroid';
        } else {
            return 'general';
        }
    }

    /**
     * Format database record to interface format
     */
    private formatRecord(dbRecord: any): BloodWorkRecord {
        return {
            id: dbRecord.id,
            name: dbRecord.name,
            date: dbRecord.date.toISOString().split('T')[0],
            fileName: dbRecord.fileName,
            fileType: dbRecord.fileType,
            interpretation: dbRecord.interpretation,
            values: dbRecord.values.map((v: any) => ({
                name: v.name,
                value: v.numericValue || v.value,
                unit: v.unit,
                normalRange: v.normalRange,
                isAbnormal: v.isAbnormal,
                category: v.category
            }))
        };
    }

    /**
     * Generate summary of blood work results
     */
    generateSummary(record: BloodWorkRecord): string {
        const abnormalResults = record.values.filter(v => v.isAbnormal);
        const totalTests = record.values.length;

        let summary = `📊 Processed ${totalTests} lab results from ${record.name}.\n\n`;

        if (abnormalResults.length > 0) {
            summary += `⚠️ Found ${abnormalResults.length} abnormal results requiring attention:\n`;
            abnormalResults.forEach(result => {
                summary += `• ${result.name}: ${result.value} ${result.unit}`;
                if (result.normalRange) {
                    summary += ` (normal: ${result.normalRange})`;
                }
                summary += '\n';
            });
        } else {
            summary += '✅ All results appear to be within normal ranges.\n';
        }

        // Add some key metrics if available
        const glucose = record.values.find(v => v.name.toLowerCase().includes('glucose'));
        const hba1c = record.values.find(v => v.name.toLowerCase().includes('hba1c') || v.name.toLowerCase().includes('a1c'));

        if (glucose || hba1c) {
            summary += '\n🔍 Key diabetes metrics:\n';
            if (glucose) {
                summary += `• Glucose: ${glucose.value} ${glucose.unit}\n`;
            }
            if (hba1c) {
                summary += `• HbA1c: ${hba1c.value} ${hba1c.unit}\n`;
            }
        }

        return summary;
    }

    /**
     * Get all records for a user
     */
    async getAllRecords(userId: string = 'default-user'): Promise<BloodWorkRecord[]> {
        const records = await this.prisma.bloodWorkRecord.findMany({
            where: { userId },
            include: { values: true },
            orderBy: { date: 'desc' }
        });

        return records.map(record => this.formatRecord(record));
    }

    /**
     * Get record by ID
     */
    async getRecord(id: string, userId: string = 'default-user'): Promise<BloodWorkRecord | null> {
        const record = await this.prisma.bloodWorkRecord.findFirst({
            where: { id, userId },
            include: { values: true }
        });

        return record ? this.formatRecord(record) : null;
    }

    /**
     * Search records by test name
     */
    async searchRecords(testName: string, userId: string = 'default-user', includeAbnormalOnly: boolean = false): Promise<any[]> {
        const whereClause: any = {
            record: { userId },
            name: {
                contains: testName,
                mode: 'insensitive'
            }
        };

        if (includeAbnormalOnly) {
            whereClause.isAbnormal = true;
        }

        const values = await this.prisma.bloodWorkValue.findMany({
            where: whereClause,
            include: {
                record: true
            },
            orderBy: { createdAt: 'desc' }
        });

        // Group by record
        const recordsMap = new Map();
        values.forEach(value => {
            const recordId = value.record.id;
            if (!recordsMap.has(recordId)) {
                recordsMap.set(recordId, {
                    recordId: value.record.id,
                    recordName: value.record.name,
                    recordDate: value.record.date.toISOString().split('T')[0],
                    matchingTests: []
                });
            }
            recordsMap.get(recordId).matchingTests.push({
                name: value.name,
                value: value.numericValue || value.value,
                unit: value.unit,
                normalRange: value.normalRange,
                isAbnormal: value.isAbnormal,
                category: value.category
            });
        });

        return Array.from(recordsMap.values());
    }

    /**
     * Get records by category (e.g., 'diabetes', 'cholesterol')
     */
    async getRecordsByCategory(category: string, userId: string = 'default-user'): Promise<any[]> {
        const values = await this.prisma.bloodWorkValue.findMany({
            where: {
                record: { userId },
                category
            },
            include: {
                record: true
            },
            orderBy: { createdAt: 'desc' }
        });

        return values.map(value => ({
            recordId: value.record.id,
            recordName: value.record.name,
            recordDate: value.record.date.toISOString().split('T')[0],
            testName: value.name,
            value: value.numericValue || value.value,
            unit: value.unit,
            normalRange: value.normalRange,
            isAbnormal: value.isAbnormal,
            category: value.category
        }));
    }

    /**
     * Get recent values for a specific test
     */
    async getRecentTestValues(testName: string, userId: string = 'default-user', limit: number = 10): Promise<any[]> {
        const values = await this.prisma.bloodWorkValue.findMany({
            where: {
                record: { userId },
                name: {
                    contains: testName,
                    mode: 'insensitive'
                }
            },
            include: {
                record: true
            },
            orderBy: { record: { date: 'desc' } },
            take: limit
        });

        return values.map(value => ({
            date: value.record.date.toISOString().split('T')[0],
            value: value.numericValue || value.value,
            unit: value.unit,
            normalRange: value.normalRange,
            isAbnormal: value.isAbnormal,
            recordName: value.record.name
        }));
    }

    /**
     * Delete a record
     */
    async deleteRecord(id: string, userId: string = 'default-user'): Promise<boolean> {
        try {
            await this.prisma.bloodWorkRecord.delete({
                where: {
                    id,
                    userId
                }
            });
            return true;
        } catch (error) {
            console.error('Error deleting blood work record:', error);
            return false;
        }
    }
} 