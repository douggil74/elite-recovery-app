// Regex patterns for parsing common person report formats
// Supports: Standard Comprehensive Report, TLO, IRB, and similar formats

// Section headers that indicate different data types
export const SECTION_PATTERNS = {
  // Subject/Person info
  subject: [
    /(?:SUBJECT|PERSON|INDIVIDUAL)\s*(?:INFORMATION|DETAILS|SUMMARY)?/i,
    /(?:NAME|FULL\s*NAME)\s*:/i,
    /STANDARD\s*COMPREHENSIVE\s*REPORT/i,
  ],

  // Addresses
  addresses: [
    /ADDRESS(?:ES)?\s*(?:SUMMARY|HISTORY|INFORMATION)?(?:\s*\(\d+\))?/i,
    /CURRENT\s*ADDRESS/i,
    /PREVIOUS\s*ADDRESS(?:ES)?/i,
    /RESIDENTIAL\s*(?:HISTORY|ADDRESS(?:ES)?)/i,
    /PROPERTY\s*(?:RECORDS?|OWNERSHIP)/i,
  ],

  // Phones
  phones: [
    /PHONE(?:S)?\s*(?:SUMMARY|NUMBERS?|INFORMATION)?(?:\s*\(\d+\))?/i,
    /TELEPHONE(?:S)?\s*(?:NUMBERS?)?/i,
    /CONTACT\s*(?:NUMBERS?|INFORMATION)/i,
  ],

  // Relatives
  relatives: [
    /RELATIVE(?:S)?\s*(?:SUMMARY|INFORMATION)?(?:\s*\(\d+\))?/i,
    /POSSIBLE\s*RELATIVE(?:S)?/i,
    /ASSOCIATE(?:S)?\s*(?:SUMMARY)?(?:\s*\(\d+\))?/i,
    /FAMILY\s*(?:MEMBERS?|CONNECTIONS?)/i,
    /KNOWN\s*(?:RELATIVES?|ASSOCIATES?)/i,
  ],

  // Vehicles
  vehicles: [
    /VEHICLE(?:S)?\s*(?:SUMMARY|INFORMATION|HISTORY)?(?:\s*\(\d+\))?/i,
    /CURRENT\s*VEHICLE(?:S)?/i,
    /HISTORICAL\s*VEHICLE(?:S)?/i,
    /REGISTERED\s*VEHICLE(?:S)?/i,
    /AUTO(?:MOBILE)?\s*(?:RECORDS?|INFORMATION)/i,
  ],

  // Employment
  employment: [
    /EMPLOYMENT\s*(?:SUMMARY|HISTORY|INFORMATION)?(?:\s*\(\d+\))?/i,
    /POSSIBLE\s*EMPLOYMENT/i,
    /WORK\s*(?:HISTORY|INFORMATION)/i,
    /EMPLOYER(?:S)?\s*(?:INFORMATION)?/i,
    /BUSINESS\s*(?:AFFILIATIONS?|RECORDS?)/i,
  ],

  // Aliases
  aliases: [
    /ALIAS(?:ES)?\s*(?:SUMMARY)?/i,
    /AKA(?:S)?/i,
    /ALSO\s*KNOWN\s*AS/i,
    /OTHER\s*NAME(?:S)?/i,
  ],
};

// Data extraction patterns
export const DATA_PATTERNS = {
  // Name patterns - stop at DOB, SSN, Age, or other keywords
  fullName: /(?:Subject|NAME|FULL\s*NAME)\s*[:\-]?\s*([A-Z][A-Za-z\-']+(?:\s+[A-Z]\.?)?(?:\s+[A-Z][A-Za-z\-']+){1,3})(?=\s+(?:DOB|SSN|Age|\(|$))/i,

  // DOB patterns - handle masked dates like 07/##/1974
  dob: [
    /(?:DOB|DATE\s*OF\s*BIRTH|BIRTH\s*DATE)\s*[:\-]?\s*(\d{1,2}[\/\-](?:\d{1,2}|##)[\/\-]\d{2,4})/i,
    /(?:DOB|DATE\s*OF\s*BIRTH|BIRTH\s*DATE)\s*[:\-]?\s*([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i,
    /\b(\d{1,2}[\/\-](?:\d{1,2}|##)[\/\-]\d{4})\s*(?:\(Age|\(DOB)/i,
  ],

  // SSN patterns (partial) - handle masked values like 436-21-#### or XXX-XX-1234
  ssn: [
    /(?:SSN|SOCIAL\s*SECURITY)\s*[:\-]?\s*\d{3}[- ]?\d{2}[- ]?(\d{4})/i,
    /(?:SSN|SOCIAL\s*SECURITY)\s*[:\-]?\s*(?:\*{3}[- ]?\*{2}[- ]?)?(\d{4})/i,
    /(?:SSN|SOCIAL)\s*[:\-]?\s*XXX-XX-(\d{4})/i,
    /(?:SSN|SOCIAL\s*SECURITY)\s*[:\-]?\s*\d{3}[- ]?\d{2}[- ]?#+/i, // Masked with #
  ],

  // Person ID
  personId: /(?:PERSON\s*ID|SUBJECT\s*ID|ID\s*NUMBER|FILE\s*NUMBER)\s*[:\-]?\s*([A-Z0-9\-]+)/i,

  // Address pattern (US format)
  address: /(\d+\s+[A-Za-z0-9\s\.\-]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way|Court|Ct|Circle|Cir|Place|Pl|Terrace|Ter)[,\s]+[A-Za-z\s]+[,\s]+[A-Z]{2}\s+\d{5}(?:-\d{4})?)/gi,

  // Simpler address - street number and name
  streetAddress: /(\d+\s+(?:[NSEW]\.?\s+)?[A-Za-z0-9\s\.\-]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way|Court|Ct|Circle|Cir|Place|Pl|Terrace|Ter|Highway|Hwy|Parkway|Pkwy)\.?)/gi,

  // City, State ZIP
  cityStateZip: /([A-Za-z\s]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/g,

  // Phone patterns
  phone: [
    /\(?\d{3}\)?[\s\-\.]?\d{3}[\s\-\.]?\d{4}/g,
    /\d{3}[\s\-\.]\d{3}[\s\-\.]\d{4}/g,
  ],

  // Date ranges for addresses/employment
  dateRange: [
    /(?:Dates|FROM|FIRST\s*SEEN|REPORTED)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}[\/\-]\d{2,4})\s*(?:TO|[-–])\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}[\/\-]\d{2,4}|CURRENT|PRESENT)/i,
    /(?:Dates|FROM|FIRST\s*SEEN|REPORTED)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{2,4})\s*(?:TO|LAST\s*SEEN|THROUGH|[-–])\s*(\d{1,2}[\/\-]\d{2,4}|CURRENT|PRESENT)/i,
    /(\d{1,2}[\/\-]\d{2,4})\s*[-–]\s*(CURRENT|PRESENT|\d{1,2}[\/\-]\d{2,4})/i,
    /REPORTED\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
  ],

  // Vehicle patterns
  vin: /\b([A-HJ-NPR-Z0-9]{17})\b/g,
  licensePlate: /(?:PLATE|TAG|LICENSE)\s*[:#]?\s*([A-Z0-9]{2,8})/gi,
  vehicleYear: /\b(19\d{2}|20[0-2]\d)\b/g,
  vehicleMakeModel: /((?:TOYOTA|HONDA|FORD|CHEVROLET|CHEVY|NISSAN|BMW|MERCEDES|AUDI|JEEP|DODGE|RAM|GMC|HYUNDAI|KIA|SUBARU|MAZDA|VOLKSWAGEN|VW|LEXUS|ACURA|INFINITI|BUICK|CADILLAC|CHRYSLER|LINCOLN|TESLA)\s+[A-Za-z0-9\-]+)/gi,

  // Relationship patterns
  relationship: /(?:RELATIONSHIP|RELATION)\s*[:\-]?\s*(MOTHER|FATHER|SON|DAUGHTER|BROTHER|SISTER|SPOUSE|WIFE|HUSBAND|COUSIN|AUNT|UNCLE|GRANDPARENT|FRIEND|ASSOCIATE|ROOMMATE|NEIGHBOR)/i,

  // Deceased indicator - must be specifically about subject, not relatives
  // Look for "Subject: ... DECEASED" or "DECEASED" right after subject name
  deceased: /(?:Subject|SUBJECT).*?\b(DECEASED)\b/i,

  // Risk flags - these patterns look for ACTUAL findings, not section headers
  // Section headers are typically "Criminal Records (0)" or "Bankruptcies" alone on a line
  riskFlags: {
    // Actual warrant - must have specific warrant language
    warrant: /(?:ACTIVE|OUTSTANDING|OPEN)\s+WARRANT/gi,
    // Fraud alert on file
    fraud: /FRAUD\s+(?:ALERT|WARNING)\s+(?:ON\s+FILE|REPORTED|ACTIVE)/gi,
  },
};

// Phone type indicators
export const PHONE_TYPE_PATTERNS = {
  mobile: /(?:MOBILE|CELL|WIRELESS)/i,
  landline: /(?:LANDLINE|HOME|RESIDENTIAL)/i,
  voip: /(?:VOIP|INTERNET|VIRTUAL)/i,
  work: /(?:WORK|BUSINESS|OFFICE)/i,
};

// Employment status patterns
export const EMPLOYMENT_STATUS = {
  current: /(?:CURRENT|PRESENT|ACTIVE|NOW)/i,
  former: /(?:FORMER|PREVIOUS|PAST|LEFT)/i,
};
