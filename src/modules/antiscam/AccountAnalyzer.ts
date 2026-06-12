// BELUM JALAN, STILL NO IDEA WHAT TO DO WITH THIS

import { GuildMember } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { AccountRiskProfile, RiskFlag } from '../../types/index';

const prisma = new PrismaClient();

export class AccountAnalyzer {
  static async analyze(member: GuildMember, guildId: string): Promise<AccountRiskProfile> {
    const flags: RiskFlag[] = [];
    let riskScore = 0;

    const accountAgeDays = Math.floor(
      (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24)
    );

    // ── Cek umur akun — makin baru, makin mencurigakan
    if (accountAgeDays < 7) {
      flags.push({ code: 'NEW_ACCOUNT_7D', severity: 'HIGH', description: 'Account is less than 7 days old' });
      riskScore += 40;
    } else if (accountAgeDays < 30) {
      flags.push({ code: 'NEW_ACCOUNT_30D', severity: 'MEDIUM', description: 'Account is less than 30 days old' });
      riskScore += 20;
    } else if (accountAgeDays < 90) {
      flags.push({ code: 'NEW_ACCOUNT_90D', severity: 'LOW', description: 'Account is less than 90 days old' });
      riskScore += 5;
    }

    // ── Cek avatar — akun tanpa pp biasanya akun baru / akun bot
    if (!member.user.avatar) {
      flags.push({ code: 'NO_AVATAR', severity: 'LOW', description: 'Account has no profile picture' });
      riskScore += 10;
    }

    // ── Cek blacklist — kalau udah keblacklist, langsung nambah skor gede
    const blacklisted = await prisma.blacklist.findFirst({
      where: { userId: member.id, isActive: true },
    });
    if (blacklisted) {
      flags.push({ code: 'BLACKLISTED', severity: 'HIGH', description: `Blacklisted: ${blacklisted.reason}` });
      riskScore += 60;
    }

    // ── Cek riwayat report — pernah dilaporin sebelumnya gak
    const reportTickets = await prisma.ticket.count({
      where: {
        guildId,
        type: 'REPORT',
        formData: { path: ['accused_id'], equals: member.id },
      },
    });
    if (reportTickets > 0) {
      flags.push({ code: 'PRIOR_REPORTS', severity: 'HIGH', description: `${reportTickets} prior report ticket(s) against this user` });
      riskScore += Math.min(reportTickets * 15, 40);
    }

    // ── Cek transaksi yang pernah didispute — banyak masalah = sus
    const disputes = await prisma.transaction.count({
      where: {
        guildId,
        status: 'DISPUTED',
        OR: [{ buyerId: member.id }, { sellerId: member.id }],
      },
    });
    if (disputes > 0) {
      flags.push({ code: 'DISPUTED_TRANSACTIONS', severity: 'MEDIUM', description: `${disputes} disputed transaction(s)` });
      riskScore += Math.min(disputes * 10, 30);
    }

    // ── Spam ticket — buka ticket terus-terusan dalam 24 jam = mencurigakan
    const recentTickets = await prisma.ticket.count({
      where: {
        guildId,
        creatorId: member.id,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (recentTickets >= 5) {
      flags.push({ code: 'TICKET_SPAM', severity: 'MEDIUM', description: `${recentTickets} tickets opened in the last 24 hours` });
      riskScore += 20;
    }

    riskScore = Math.min(100, riskScore);

    let recommendation: AccountRiskProfile['recommendation'] = 'ALLOW';
    if (riskScore >= 70) recommendation = 'BLOCK';
    else if (riskScore >= 35) recommendation = 'WARN_STAFF';

    return { userId: member.id, accountAgeDays, riskScore, flags, recommendation };
  }
}
