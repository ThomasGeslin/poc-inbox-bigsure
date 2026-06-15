-- AlterEnum
ALTER TYPE "ConversationStatus" ADD VALUE 'DEVIS_APRES_VISITE';

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN "channel" "Channel" NOT NULL DEFAULT 'MAIL';

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed data
-- ─────────────────────────────────────────────────────────────────────────────

-- Contacts
INSERT INTO "contacts" ("id", "name", "email", "phone", "role", "company", "createdAt") VALUES
  ('c1', 'Sophie Martin',   'sophie.martin@techcorp.fr',    '+33 6 12 34 56 78', 'Responsable Achat',  'TechCorp SAS',  NOW()),
  ('c2', 'Thomas Dupont',   'thomas.dupont@constructpro.fr','+33 6 23 45 67 89', 'Directeur Technique','ConstructPro',  NOW()),
  ('c3', 'Marie Leclerc',   'marie.leclerc@innov-group.fr', '+33 6 34 56 78 90', 'Gérante',            'Innov Group',   NOW()),
  ('c4', 'Julien Bernard',  'j.bernard@batiprime.fr',       '+33 6 45 67 89 01', 'Chef de Projet',     'BatiPrime',     NOW()),
  ('c5', 'Camille Rousseau','c.rousseau@archi-studio.fr',   '+33 6 56 78 90 12', 'Architecte',         'Archi Studio',  NOW()),
  ('c6', 'Pierre Moreau',   'p.moreau@logiplex.fr',         '+33 7 67 89 01 23', 'Acheteur',           'Logiplex',      NOW())
ON CONFLICT ("id") DO NOTHING;

-- Conversations
INSERT INTO "conversations" ("id", "contactId", "subject", "status", "channel", "unreadCount", "lastMessageAt", "createdAt") VALUES
  ('conv1','c1','Demande de devis — Charpente bois',  'A_TRAITER',          'MAIL',     3, '2026-06-15 09:42:00', NOW()),
  ('conv2','c2','Suivi chantier Dupont — Phase 2',    'A_PLANIFIER',        'WHATSAPP', 1, '2026-06-15 08:15:00', NOW()),
  ('conv3','c3','Devis extension bureau — Leclerc',   'DEVIS_APRES_VISITE', 'MAIL',     0, '2026-06-14 16:30:00', NOW()),
  ('conv4','c4','Livraison matériaux — BatiPrime',    'EN_ATTENTE',         'SMS',      2, '2026-06-14 11:20:00', NOW()),
  ('conv5','c5','Projet rénovation Villa Rousseau',   'A_TRAITER',          'CALL',     1, '2026-06-13 14:05:00', NOW()),
  ('conv6','c6','Commande #2024-0892 — Logiplex',     'TRAITE',             'MAIL',     0, '2026-06-13 10:00:00', NOW())
ON CONFLICT ("id") DO NOTHING;

-- Messages – conv1 (Sophie Martin)
INSERT INTO "messages" ("id", "conversationId", "channel", "direction", "content", "meta", "timestamp") VALUES
  ('m1','conv1','MAIL','INBOUND',
   'Bonjour,' || chr(10) || chr(10) || 'Suite à notre échange téléphonique, je vous contacte pour obtenir un devis pour la fourniture et pose d''une charpente bois pour notre entrepôt de 450 m². Pourriez-vous me faire parvenir une proposition détaillée avant fin de semaine ?' || chr(10) || chr(10) || 'Cordialement,' || chr(10) || 'Sophie Martin',
   '{"subject":"Demande de devis — Charpente bois"}','2026-06-13 08:30:00'),
  ('m2','conv1','CALL','OUTBOUND','Appel sortant vers Sophie Martin',
   '{"callStatus":"outbound","duration":245}','2026-06-13 10:15:00'),
  ('m3','conv1','MAIL','OUTBOUND',
   'Bonjour Sophie,' || chr(10) || chr(10) || 'Merci pour votre message. Nous avons bien pris note de votre demande. Je vous prépare un devis détaillé que vous recevrez d''ici vendredi. N''hésitez pas à me joindre si vous avez des questions.' || chr(10) || chr(10) || 'Cordialement,' || chr(10) || 'Équipe Commerciale',
   '{"subject":"RE: Demande de devis — Charpente bois"}','2026-06-13 14:00:00'),
  ('m4','conv1','MAIL','INBOUND',
   'Bonjour,' || chr(10) || chr(10) || 'Merci pour votre retour. Une précision : il faudrait inclure aussi la zinguerie. Pouvez-vous me confirmer la disponibilité pour semaine prochaine ?',
   '{"subject":"RE: Demande de devis — Charpente bois"}','2026-06-15 09:42:00')
ON CONFLICT ("id") DO NOTHING;

-- Messages – conv2 (Thomas Dupont)
INSERT INTO "messages" ("id", "conversationId", "channel", "direction", "content", "meta", "timestamp") VALUES
  ('m5','conv2','WHATSAPP','OUTBOUND','Bonjour Thomas, on confirme le RDV de jeudi pour la visite chantier phase 2 ?',NULL,'2026-06-14 09:00:00'),
  ('m6','conv2','CALL','INBOUND','Appel entrant de Thomas Dupont','{"callStatus":"missed"}','2026-06-14 09:28:00'),
  ('m7','conv2','WHATSAPP','INBOUND','Désolé j''ai raté votre appel ! Oui c''est ok pour jeudi, on se retrouve à 9h sur le chantier.',NULL,'2026-06-14 11:15:00'),
  ('m8','conv2','WHATSAPP','INBOUND','RDV confirmé pour jeudi 9h00 sur site 👍',NULL,'2026-06-15 08:15:00')
ON CONFLICT ("id") DO NOTHING;

-- Messages – conv3 (Marie Leclerc)
INSERT INTO "messages" ("id", "conversationId", "channel", "direction", "content", "meta", "timestamp") VALUES
  ('m9','conv3','MAIL','INBOUND',
   'Bonjour,' || chr(10) || chr(10) || 'Je souhaiterais obtenir un devis pour l''extension de mon bureau (environ 30 m²). Nous sommes disponibles pour une visite la semaine prochaine.' || chr(10) || chr(10) || 'Bien cordialement,' || chr(10) || 'Marie Leclerc',
   '{"subject":"Devis extension bureau"}','2026-06-13 08:00:00'),
  ('m10','conv3','CALL','OUTBOUND','Appel sortant vers Marie Leclerc','{"callStatus":"outbound","duration":420}','2026-06-13 10:30:00'),
  ('m11','conv3','WHATSAPP','OUTBOUND','Bonjour Marie, je vous confirme notre visite lundi prochain à 14h30. À lundi ! 😊',NULL,'2026-06-13 11:00:00'),
  ('m12','conv3','WHATSAPP','INBOUND','Parfait, c''est noté ! À lundi.',NULL,'2026-06-13 11:10:00'),
  ('m13','conv3','MAIL','INBOUND',
   'Bonjour,' || chr(10) || chr(10) || 'Merci pour votre visite, j''attends votre proposition.' || chr(10) || chr(10) || 'Cordialement',
   '{"subject":"Devis extension bureau — Leclerc"}','2026-06-14 16:30:00')
ON CONFLICT ("id") DO NOTHING;

-- Messages – conv4 (Julien Bernard)
INSERT INTO "messages" ("id", "conversationId", "channel", "direction", "content", "meta", "timestamp") VALUES
  ('m14','conv4','SMS','OUTBOUND','Bonjour Julien, votre commande de matériaux est en cours de préparation, livraison prévue demain matin.',NULL,'2026-06-13 14:00:00'),
  ('m15','conv4','CALL','INBOUND','Appel entrant de Julien Bernard','{"callStatus":"missed"}','2026-06-14 09:05:00'),
  ('m16','conv4','SMS','INBOUND','Tj pas reçu la livraison. Vous pouvez rappeler ?',NULL,'2026-06-14 11:20:00')
ON CONFLICT ("id") DO NOTHING;

-- Messages – conv5 (Camille Rousseau)
INSERT INTO "messages" ("id", "conversationId", "channel", "direction", "content", "meta", "timestamp") VALUES
  ('m17','conv5','WHATSAPP','INBOUND','Bonjour, je vous contacte pour le projet de rénovation de la Villa Rousseau. Pouvez-vous me rappeler ?',NULL,'2026-06-13 10:00:00'),
  ('m18','conv5','CALL','OUTBOUND','Appel sortant vers Camille Rousseau','{"callStatus":"outbound","duration":180}','2026-06-13 10:30:00'),
  ('m19','conv5','CALL','INBOUND','Appel entrant de Camille Rousseau','{"callStatus":"missed","duration":154}','2026-06-13 14:05:00')
ON CONFLICT ("id") DO NOTHING;

-- Messages – conv6 (Pierre Moreau)
INSERT INTO "messages" ("id", "conversationId", "channel", "direction", "content", "meta", "timestamp") VALUES
  ('m20','conv6','MAIL','INBOUND',
   'Bonjour,' || chr(10) || chr(10) || 'Je souhaite passer commande pour les références suivantes :' || chr(10) || '- REF-001 (×10)' || chr(10) || '- REF-045 (×5)' || chr(10) || '- REF-112 (×2)' || chr(10) || chr(10) || 'Merci de confirmer la disponibilité et les délais.' || chr(10) || chr(10) || 'Cordialement,' || chr(10) || 'Pierre Moreau',
   '{"subject":"Commande #2024-0892"}','2026-06-13 09:00:00'),
  ('m21','conv6','MAIL','OUTBOUND',
   'Bonjour Pierre,' || chr(10) || chr(10) || 'Nous avons bien enregistré votre commande #2024-0892. Toutes les références sont disponibles, livraison estimée sous 3 à 5 jours ouvrés.' || chr(10) || chr(10) || 'Cordialement,' || chr(10) || 'Équipe Commerciale',
   '{"subject":"RE: Commande #2024-0892"}','2026-06-13 09:45:00'),
  ('m22','conv6','MAIL','INBOUND','Parfait, la commande a bien été enregistrée. Merci !',
   '{"subject":"RE: Commande #2024-0892"}','2026-06-13 10:00:00')
ON CONFLICT ("id") DO NOTHING;
