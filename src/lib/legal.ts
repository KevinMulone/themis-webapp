import 'server-only';

export type IdentitaLegale = {
  denominazione: string;
  sede: string;
  partitaIva: string;
  emailPrivacy: string;
  completa: boolean;
};

export function identitaLegale(): IdentitaLegale {
  const denominazione = process.env.LEGAL_ENTITY_NAME?.trim() ?? '';
  const sede = process.env.LEGAL_ENTITY_ADDRESS?.trim() ?? '';
  const partitaIva = process.env.LEGAL_ENTITY_VAT?.trim() ?? '';
  const emailPrivacy = process.env.PRIVACY_CONTACT_EMAIL?.trim() ?? '';
  return {
    denominazione,
    sede,
    partitaIva,
    emailPrivacy,
    completa: Boolean(denominazione && sede && partitaIva && emailPrivacy),
  };
}
