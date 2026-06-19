import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CallsController } from './calls.controller';
import { PrismaService } from '../../../prisma/prisma.service';
import { TwilioService } from '../services/twilio.service';

const CONTACT_ID = 'contact-1';
const PHONE = '+33612345678';
const CALL_SID = 'CAabc123';

describe('CallsController', () => {
  let controller: CallsController;
  let prisma: jest.Mocked<PrismaService>;
  let twilio: jest.Mocked<TwilioService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CallsController],
      providers: [
        {
          provide: PrismaService,
          useValue: { contact: { findUnique: jest.fn() } },
        },
        {
          provide: TwilioService,
          useValue: { initiateCall: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(CallsController);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    twilio = module.get(TwilioService) as jest.Mocked<TwilioService>;
  });

  describe('POST /calls/initiate', () => {
    it('initiates a call to the contact phone and returns callSid', async () => {
      (prisma.contact.findUnique as jest.Mock).mockResolvedValue({
        id: CONTACT_ID,
        phone: PHONE,
        name: 'Alice',
      });
      (twilio.initiateCall as jest.Mock).mockResolvedValue(CALL_SID);

      const result = await controller.initiateCall({ contactId: CONTACT_ID });

      expect(prisma.contact.findUnique).toHaveBeenCalledWith({
        where: { id: CONTACT_ID },
      });
      expect(twilio.initiateCall).toHaveBeenCalledWith(PHONE);
      expect(result).toEqual({ callSid: CALL_SID });
    });

    it('throws NotFoundException when contact does not exist', async () => {
      (prisma.contact.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        controller.initiateCall({ contactId: 'nonexistent' }),
      ).rejects.toThrow(NotFoundException);

      expect(twilio.initiateCall).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when contact exists but has no phone number', async () => {
      (prisma.contact.findUnique as jest.Mock).mockResolvedValue({
        id: CONTACT_ID,
        phone: null,
        name: 'Email-only contact',
      });

      await expect(
        controller.initiateCall({ contactId: CONTACT_ID }),
      ).rejects.toThrow(NotFoundException);

      expect(twilio.initiateCall).not.toHaveBeenCalled();
    });
  });
});
