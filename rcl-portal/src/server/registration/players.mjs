// Create/refresh a player row from an RMIS mirror member. Shared by registration and replacements.
import { normaliseNic } from './eligibility.mjs'

/**
 * @param c        a transaction client
 * @param member   row from rmis_members
 * @param norm     normalised status (1 general | 5 prospective)
 * @param ri       RI number to store (null keeps any stored one)
 * Never undoes an admin conversion (converted players stay prospective).
 */
export async function upsertPlayerFromMirror(c, member, norm, ri) {
  await c.query(
    `INSERT INTO players (member_id, membership_id, ri_id, name, club_id, nic, birthdate, gender, status, rmis_status, rmis_club_id, rmis_synced_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
     ON CONFLICT (member_id) DO UPDATE SET
       membership_id = EXCLUDED.membership_id, ri_id = COALESCE(EXCLUDED.ri_id, players.ri_id), name = EXCLUDED.name,
       club_id = EXCLUDED.club_id, nic = EXCLUDED.nic, birthdate = EXCLUDED.birthdate, gender = EXCLUDED.gender,
       status = CASE WHEN players.converted THEN players.status ELSE EXCLUDED.status END,
       rmis_status = EXCLUDED.rmis_status, rmis_club_id = EXCLUDED.rmis_club_id, rmis_synced_at = now()`,
    [member.member_id, member.membership_id, ri, member.full_name || member.card_name || 'Unnamed member', member.club_id, normaliseNic(member.nic),
     member.dob, member.gender, norm, member.status, member.club_id])
}
