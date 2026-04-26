import { db } from "@/lib/db";

const SA_COMPANIES = [
  { name: "Santam", shortName: "STM", folderName: "santam", senderDomains: ["santam.co.za"] },
  { name: "OUTsurance", shortName: "OUT", folderName: "outsurance", senderDomains: ["outsurance.co.za"] },
  { name: "Discovery Insure", shortName: "DIS", folderName: "discovery", senderDomains: ["discovery.co.za", "discoveryinsurance.co.za"] },
  { name: "MiWay", shortName: "MIW", folderName: "miway", senderDomains: ["miway.co.za"] },
  { name: "Old Mutual Insure", shortName: "OMI", folderName: "old-mutual", senderDomains: ["oldmutual.co.za", "mutualandfederal.co.za"] },
  { name: "Hollard Insurance", shortName: "HOL", folderName: "hollard", senderDomains: ["hollard.co.za", "hollardinsure.co.za"] },
  { name: "Budget Insurance", shortName: "BUD", folderName: "budget", senderDomains: ["budgetinsurance.co.za"] },
  { name: "King Price Insurance", shortName: "KPI", folderName: "king-price", senderDomains: ["kingprice.co.za"] },
  { name: "Momentum Insure", shortName: "MMI", folderName: "momentum", senderDomains: ["momentum.co.za", "momentuminsure.co.za"] },
  { name: "Liberty Insurance", shortName: "LIB", folderName: "liberty", senderDomains: ["liberty.co.za"] },
  { name: "African Bank Insurance", shortName: "ABI", folderName: "african-bank", senderDomains: ["africanbank.co.za"] },
  { name: "FNB Insurance", shortName: "FNB", folderName: "fnb", senderDomains: ["fnb.co.za"] },
  { name: "Standard Bank Insurance", shortName: "SBI", folderName: "standard-bank", senderDomains: ["standardbank.co.za"] },
  { name: "Absa Insurance", shortName: "ABS", folderName: "absa", senderDomains: ["absa.co.za"] },
  { name: "Capitec Insurance", shortName: "CAP", folderName: "capitec", senderDomains: ["capitecbank.co.za"] },
  { name: "Telesure Investment Holdings", shortName: "TIH", folderName: "telesure", senderDomains: ["telesure.co.za"] },
  { name: "Aon South Africa", shortName: "AON", folderName: "aon", senderDomains: ["aon.co.za"] },
  { name: "Marsh Africa", shortName: "MAR", folderName: "marsh", senderDomains: ["marsh.co.za"] },
  { name: "Alexander Forbes", shortName: "AFB", folderName: "alexander-forbes", senderDomains: ["alexanderforbes.co.za"] },
  { name: "Sanlam Insurance", shortName: "SLM", folderName: "sanlam", senderDomains: ["sanlam.co.za"] },
  { name: "Gryphon Insurance", shortName: "GRY", folderName: "gryphon", senderDomains: ["gryphon.co.za"] },
  { name: "CIB Insurance Administrators", shortName: "CIB", folderName: "cib", senderDomains: ["cibs.co.za"] },
  { name: "AIG South Africa", shortName: "AIG", folderName: "aig", senderDomains: ["chartis.co.za", "aig.co.za"] },
  { name: "Allianz Global Corporate", shortName: "ALZ", folderName: "allianz", senderDomains: ["allianz.co.za"] },
  { name: "Chubb Insurance", shortName: "CHB", folderName: "chubb", senderDomains: ["chubb.co.za"] },
  { name: "RENASA Insurance", shortName: "RNA", folderName: "renasa", senderDomains: ["renasa.co.za"] },
  { name: "SBV Services Insurance", shortName: "SBV", folderName: "sbv", senderDomains: ["sbv.co.za"] },
  { name: "Mutual & Federal", shortName: "M&F", folderName: "mutual-federal", senderDomains: ["mag.co.za"] },
  { name: "Auto & General", shortName: "A&G", folderName: "auto-general", senderDomains: ["autogeneral.co.za"] },
  { name: "Dial Direct", shortName: "DIL", folderName: "dial-direct", senderDomains: ["dialdirect.co.za"] },
  { name: "First for Women", shortName: "FFW", folderName: "first-for-women", senderDomains: ["firstforwomen.co.za"] },
  { name: "Virseker", shortName: "VIR", folderName: "virseker", senderDomains: ["virseker.co.za"] },
  { name: "Indwe Risk Services", shortName: "IND", folderName: "indwe", senderDomains: ["indwe.co.za"] },
  { name: "Regent Insurance", shortName: "REG", folderName: "regent", senderDomains: ["regent.co.za"] },
  { name: "African Unity", shortName: "AFU", folderName: "african-unity", senderDomains: ["africanunity.co.za"] },
];

async function seedCompanies() {
  let created = 0;
  let skipped = 0;

  for (const company of SA_COMPANIES) {
    const existing = await db.insuranceCompany.findFirst({
      where: { name: company.name }
    });

    if (!existing) {
      await db.insuranceCompany.create({
        data: {
          name: company.name,
          shortName: company.shortName,
          folderName: company.folderName,
          senderDomains: JSON.stringify(company.senderDomains),
          isActive: true,
        }
      });
      created++;
      console.log(`Created: ${company.name}`);
    } else {
      skipped++;
      console.log(`Skipped (exists): ${company.name}`);
    }
  }

  console.log(`\nDone! Created: ${created}, Skipped: ${skipped}`);
}

seedCompanies().catch(console.error);
