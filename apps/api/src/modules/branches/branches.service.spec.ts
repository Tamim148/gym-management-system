import { BranchesService } from './branches.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('BranchesService', () => {
  it('enriches branches with staffedHours and non-PII coaches', async () => {
    const prismaMock = {
      branch: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: '10000000-0000-4000-8000-000000000001',
            name: 'Gulshan-1 Flagship',
            code: 'DHK-01',
            address: 'Road 12, Gulshan-1, Dhaka 1212',
            timezone: 'Asia/Dhaka',
            maxOccupancy: 80,
            currentOccupancy: 42,
            edgeNodeOnline: true,
            lastEdgeHeartbeat: new Date('2026-11-28T10:00:00Z'),
          },
          {
            id: '10000000-0000-4000-8000-000000000002',
            name: 'Dhanmondi Iron Club',
            code: 'DHK-02',
            address: 'Satmasjid Road, Dhanmondi 27, Dhaka 1209',
            timezone: 'Asia/Dhaka',
            maxOccupancy: 70,
            currentOccupancy: 28,
            edgeNodeOnline: true,
            lastEdgeHeartbeat: new Date('2026-11-28T10:00:00Z'),
          },
        ]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'trainer-1',
            fullName: 'Arif Hasan',
            homeBranchId: '10000000-0000-4000-8000-000000000001',
            specializationsCsv: 'HIIT, Hypertrophy',
            certifications: 'ACE CPT',
          },
          {
            id: 'trainer-2',
            fullName: 'Imran Chowdhury',
            homeBranchId: '10000000-0000-4000-8000-000000000001',
            specializationsCsv: '   ',
            certifications: 'CSCS Certified',
          },
          {
            id: 'trainer-3',
            fullName: 'Nabil Karim',
            homeBranchId: '10000000-0000-4000-8000-000000000002',
            specializationsCsv: null,
            certifications: null,
          },
        ]),
      },
    } as unknown as PrismaService;

    const service = new BranchesService(prismaMock);
    const result = await service.listBranches();

    expect(result).toHaveLength(2);
    expect(result[0].staffedHours).toBe('06:00 AM – 11:00 PM (24/7 Member RFID)');
    expect(result[0].coaches).toEqual([
      {
        id: 'trainer-1',
        fullName: 'Arif Hasan',
        specialty: 'HIIT, Hypertrophy',
        branchCode: 'DHK-01',
      },
      {
        id: 'trainer-2',
        fullName: 'Imran Chowdhury',
        specialty: 'CSCS Certified',
        branchCode: 'DHK-01',
      },
    ]);
    expect(result[1].coaches).toEqual([
      {
        id: 'trainer-3',
        fullName: 'Nabil Karim',
        specialty: 'Strength & Conditioning',
        branchCode: 'DHK-02',
      },
    ]);
  });

  it('handles minimal test doubles where user.findMany is absent', async () => {
    const prismaMock = {
      branch: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: '10000000-0000-4000-8000-000000000003',
            name: 'Uttara Sector-7 Studio',
            code: 'DHK-03',
            address: 'Road 18, Sector 7, Uttara',
            timezone: 'Asia/Dhaka',
            maxOccupancy: 60,
            currentOccupancy: 19,
            edgeNodeOnline: true,
            lastEdgeHeartbeat: null,
          },
        ]),
      },
    } as unknown as PrismaService;

    const service = new BranchesService(prismaMock);
    const result = await service.listBranches();

    expect(result[0].staffedHours).toBe('06:00 AM – 11:00 PM (24/7 Member RFID)');
    expect(result[0].coaches).toEqual([]);
  });
});
