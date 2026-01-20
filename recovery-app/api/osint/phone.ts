/**
 * OSINT Phone Intelligence API
 * Analyzes phone numbers and searches for associated information
 * Self-sufficient - no external dependencies
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface PhoneAnalysis {
  number: string;
  formatted: string;
  countryCode: string;
  areaCode: string;
  lineType: string;
  carrier: string;
  location: {
    state: string;
    city: string;
    timezone: string;
  };
  isValid: boolean;
  isPossibleMobile: boolean;
  isPossibleVoIP: boolean;
}

// US Area codes with location data
const US_AREA_CODES: Record<string, { state: string; city: string; timezone: string }> = {
  '201': { state: 'NJ', city: 'Jersey City', timezone: 'EST' },
  '202': { state: 'DC', city: 'Washington', timezone: 'EST' },
  '203': { state: 'CT', city: 'New Haven', timezone: 'EST' },
  '205': { state: 'AL', city: 'Birmingham', timezone: 'CST' },
  '206': { state: 'WA', city: 'Seattle', timezone: 'PST' },
  '207': { state: 'ME', city: 'Portland', timezone: 'EST' },
  '208': { state: 'ID', city: 'Boise', timezone: 'MST' },
  '209': { state: 'CA', city: 'Stockton', timezone: 'PST' },
  '210': { state: 'TX', city: 'San Antonio', timezone: 'CST' },
  '212': { state: 'NY', city: 'New York', timezone: 'EST' },
  '213': { state: 'CA', city: 'Los Angeles', timezone: 'PST' },
  '214': { state: 'TX', city: 'Dallas', timezone: 'CST' },
  '215': { state: 'PA', city: 'Philadelphia', timezone: 'EST' },
  '216': { state: 'OH', city: 'Cleveland', timezone: 'EST' },
  '217': { state: 'IL', city: 'Springfield', timezone: 'CST' },
  '218': { state: 'MN', city: 'Duluth', timezone: 'CST' },
  '219': { state: 'IN', city: 'Gary', timezone: 'CST' },
  '224': { state: 'IL', city: 'Chicago suburbs', timezone: 'CST' },
  '225': { state: 'LA', city: 'Baton Rouge', timezone: 'CST' },
  '228': { state: 'MS', city: 'Gulfport', timezone: 'CST' },
  '229': { state: 'GA', city: 'Albany', timezone: 'EST' },
  '231': { state: 'MI', city: 'Muskegon', timezone: 'EST' },
  '234': { state: 'OH', city: 'Akron', timezone: 'EST' },
  '239': { state: 'FL', city: 'Fort Myers', timezone: 'EST' },
  '240': { state: 'MD', city: 'Bethesda', timezone: 'EST' },
  '248': { state: 'MI', city: 'Troy', timezone: 'EST' },
  '251': { state: 'AL', city: 'Mobile', timezone: 'CST' },
  '252': { state: 'NC', city: 'Greenville', timezone: 'EST' },
  '253': { state: 'WA', city: 'Tacoma', timezone: 'PST' },
  '254': { state: 'TX', city: 'Waco', timezone: 'CST' },
  '256': { state: 'AL', city: 'Huntsville', timezone: 'CST' },
  '260': { state: 'IN', city: 'Fort Wayne', timezone: 'EST' },
  '262': { state: 'WI', city: 'Kenosha', timezone: 'CST' },
  '267': { state: 'PA', city: 'Philadelphia', timezone: 'EST' },
  '269': { state: 'MI', city: 'Kalamazoo', timezone: 'EST' },
  '270': { state: 'KY', city: 'Bowling Green', timezone: 'CST' },
  '276': { state: 'VA', city: 'Bristol', timezone: 'EST' },
  '281': { state: 'TX', city: 'Houston', timezone: 'CST' },
  '301': { state: 'MD', city: 'Silver Spring', timezone: 'EST' },
  '302': { state: 'DE', city: 'Wilmington', timezone: 'EST' },
  '303': { state: 'CO', city: 'Denver', timezone: 'MST' },
  '304': { state: 'WV', city: 'Charleston', timezone: 'EST' },
  '305': { state: 'FL', city: 'Miami', timezone: 'EST' },
  '307': { state: 'WY', city: 'Cheyenne', timezone: 'MST' },
  '308': { state: 'NE', city: 'Grand Island', timezone: 'CST' },
  '309': { state: 'IL', city: 'Peoria', timezone: 'CST' },
  '310': { state: 'CA', city: 'Los Angeles', timezone: 'PST' },
  '312': { state: 'IL', city: 'Chicago', timezone: 'CST' },
  '313': { state: 'MI', city: 'Detroit', timezone: 'EST' },
  '314': { state: 'MO', city: 'St. Louis', timezone: 'CST' },
  '315': { state: 'NY', city: 'Syracuse', timezone: 'EST' },
  '316': { state: 'KS', city: 'Wichita', timezone: 'CST' },
  '317': { state: 'IN', city: 'Indianapolis', timezone: 'EST' },
  '318': { state: 'LA', city: 'Shreveport', timezone: 'CST' },
  '319': { state: 'IA', city: 'Cedar Rapids', timezone: 'CST' },
  '320': { state: 'MN', city: 'St. Cloud', timezone: 'CST' },
  '321': { state: 'FL', city: 'Orlando', timezone: 'EST' },
  '323': { state: 'CA', city: 'Los Angeles', timezone: 'PST' },
  '325': { state: 'TX', city: 'Abilene', timezone: 'CST' },
  '330': { state: 'OH', city: 'Akron', timezone: 'EST' },
  '334': { state: 'AL', city: 'Montgomery', timezone: 'CST' },
  '336': { state: 'NC', city: 'Greensboro', timezone: 'EST' },
  '337': { state: 'LA', city: 'Lafayette', timezone: 'CST' },
  '339': { state: 'MA', city: 'Boston', timezone: 'EST' },
  '347': { state: 'NY', city: 'New York', timezone: 'EST' },
  '351': { state: 'MA', city: 'Lowell', timezone: 'EST' },
  '352': { state: 'FL', city: 'Gainesville', timezone: 'EST' },
  '360': { state: 'WA', city: 'Vancouver', timezone: 'PST' },
  '361': { state: 'TX', city: 'Corpus Christi', timezone: 'CST' },
  '386': { state: 'FL', city: 'Daytona Beach', timezone: 'EST' },
  '401': { state: 'RI', city: 'Providence', timezone: 'EST' },
  '402': { state: 'NE', city: 'Omaha', timezone: 'CST' },
  '404': { state: 'GA', city: 'Atlanta', timezone: 'EST' },
  '405': { state: 'OK', city: 'Oklahoma City', timezone: 'CST' },
  '406': { state: 'MT', city: 'Billings', timezone: 'MST' },
  '407': { state: 'FL', city: 'Orlando', timezone: 'EST' },
  '408': { state: 'CA', city: 'San Jose', timezone: 'PST' },
  '409': { state: 'TX', city: 'Beaumont', timezone: 'CST' },
  '410': { state: 'MD', city: 'Baltimore', timezone: 'EST' },
  '412': { state: 'PA', city: 'Pittsburgh', timezone: 'EST' },
  '413': { state: 'MA', city: 'Springfield', timezone: 'EST' },
  '414': { state: 'WI', city: 'Milwaukee', timezone: 'CST' },
  '415': { state: 'CA', city: 'San Francisco', timezone: 'PST' },
  '417': { state: 'MO', city: 'Springfield', timezone: 'CST' },
  '419': { state: 'OH', city: 'Toledo', timezone: 'EST' },
  '423': { state: 'TN', city: 'Chattanooga', timezone: 'EST' },
  '424': { state: 'CA', city: 'Los Angeles', timezone: 'PST' },
  '425': { state: 'WA', city: 'Bellevue', timezone: 'PST' },
  '432': { state: 'TX', city: 'Midland', timezone: 'CST' },
  '434': { state: 'VA', city: 'Lynchburg', timezone: 'EST' },
  '435': { state: 'UT', city: 'St. George', timezone: 'MST' },
  '440': { state: 'OH', city: 'Cleveland suburbs', timezone: 'EST' },
  '443': { state: 'MD', city: 'Baltimore', timezone: 'EST' },
  '469': { state: 'TX', city: 'Dallas', timezone: 'CST' },
  '470': { state: 'GA', city: 'Atlanta', timezone: 'EST' },
  '478': { state: 'GA', city: 'Macon', timezone: 'EST' },
  '479': { state: 'AR', city: 'Fort Smith', timezone: 'CST' },
  '480': { state: 'AZ', city: 'Mesa', timezone: 'MST' },
  '484': { state: 'PA', city: 'Allentown', timezone: 'EST' },
  '501': { state: 'AR', city: 'Little Rock', timezone: 'CST' },
  '502': { state: 'KY', city: 'Louisville', timezone: 'EST' },
  '503': { state: 'OR', city: 'Portland', timezone: 'PST' },
  '504': { state: 'LA', city: 'New Orleans', timezone: 'CST' },
  '505': { state: 'NM', city: 'Albuquerque', timezone: 'MST' },
  '507': { state: 'MN', city: 'Rochester', timezone: 'CST' },
  '508': { state: 'MA', city: 'Worcester', timezone: 'EST' },
  '509': { state: 'WA', city: 'Spokane', timezone: 'PST' },
  '510': { state: 'CA', city: 'Oakland', timezone: 'PST' },
  '512': { state: 'TX', city: 'Austin', timezone: 'CST' },
  '513': { state: 'OH', city: 'Cincinnati', timezone: 'EST' },
  '515': { state: 'IA', city: 'Des Moines', timezone: 'CST' },
  '516': { state: 'NY', city: 'Long Island', timezone: 'EST' },
  '517': { state: 'MI', city: 'Lansing', timezone: 'EST' },
  '518': { state: 'NY', city: 'Albany', timezone: 'EST' },
  '520': { state: 'AZ', city: 'Tucson', timezone: 'MST' },
  '530': { state: 'CA', city: 'Redding', timezone: 'PST' },
  '540': { state: 'VA', city: 'Roanoke', timezone: 'EST' },
  '541': { state: 'OR', city: 'Eugene', timezone: 'PST' },
  '551': { state: 'NJ', city: 'Jersey City', timezone: 'EST' },
  '559': { state: 'CA', city: 'Fresno', timezone: 'PST' },
  '561': { state: 'FL', city: 'West Palm Beach', timezone: 'EST' },
  '562': { state: 'CA', city: 'Long Beach', timezone: 'PST' },
  '563': { state: 'IA', city: 'Davenport', timezone: 'CST' },
  '567': { state: 'OH', city: 'Toledo', timezone: 'EST' },
  '570': { state: 'PA', city: 'Scranton', timezone: 'EST' },
  '571': { state: 'VA', city: 'Arlington', timezone: 'EST' },
  '573': { state: 'MO', city: 'Columbia', timezone: 'CST' },
  '574': { state: 'IN', city: 'South Bend', timezone: 'EST' },
  '580': { state: 'OK', city: 'Lawton', timezone: 'CST' },
  '585': { state: 'NY', city: 'Rochester', timezone: 'EST' },
  '586': { state: 'MI', city: 'Warren', timezone: 'EST' },
  '601': { state: 'MS', city: 'Jackson', timezone: 'CST' },
  '602': { state: 'AZ', city: 'Phoenix', timezone: 'MST' },
  '603': { state: 'NH', city: 'Manchester', timezone: 'EST' },
  '605': { state: 'SD', city: 'Sioux Falls', timezone: 'CST' },
  '606': { state: 'KY', city: 'Ashland', timezone: 'EST' },
  '607': { state: 'NY', city: 'Binghamton', timezone: 'EST' },
  '608': { state: 'WI', city: 'Madison', timezone: 'CST' },
  '609': { state: 'NJ', city: 'Trenton', timezone: 'EST' },
  '610': { state: 'PA', city: 'Allentown', timezone: 'EST' },
  '612': { state: 'MN', city: 'Minneapolis', timezone: 'CST' },
  '614': { state: 'OH', city: 'Columbus', timezone: 'EST' },
  '615': { state: 'TN', city: 'Nashville', timezone: 'CST' },
  '616': { state: 'MI', city: 'Grand Rapids', timezone: 'EST' },
  '617': { state: 'MA', city: 'Boston', timezone: 'EST' },
  '618': { state: 'IL', city: 'Belleville', timezone: 'CST' },
  '619': { state: 'CA', city: 'San Diego', timezone: 'PST' },
  '620': { state: 'KS', city: 'Dodge City', timezone: 'CST' },
  '623': { state: 'AZ', city: 'Phoenix', timezone: 'MST' },
  '626': { state: 'CA', city: 'Pasadena', timezone: 'PST' },
  '628': { state: 'CA', city: 'San Francisco', timezone: 'PST' },
  '630': { state: 'IL', city: 'Aurora', timezone: 'CST' },
  '631': { state: 'NY', city: 'Long Island', timezone: 'EST' },
  '636': { state: 'MO', city: 'St. Charles', timezone: 'CST' },
  '646': { state: 'NY', city: 'New York', timezone: 'EST' },
  '650': { state: 'CA', city: 'San Mateo', timezone: 'PST' },
  '651': { state: 'MN', city: 'St. Paul', timezone: 'CST' },
  '657': { state: 'CA', city: 'Anaheim', timezone: 'PST' },
  '660': { state: 'MO', city: 'Sedalia', timezone: 'CST' },
  '661': { state: 'CA', city: 'Bakersfield', timezone: 'PST' },
  '662': { state: 'MS', city: 'Tupelo', timezone: 'CST' },
  '678': { state: 'GA', city: 'Atlanta', timezone: 'EST' },
  '681': { state: 'WV', city: 'Charleston', timezone: 'EST' },
  '682': { state: 'TX', city: 'Fort Worth', timezone: 'CST' },
  '701': { state: 'ND', city: 'Fargo', timezone: 'CST' },
  '702': { state: 'NV', city: 'Las Vegas', timezone: 'PST' },
  '703': { state: 'VA', city: 'Arlington', timezone: 'EST' },
  '704': { state: 'NC', city: 'Charlotte', timezone: 'EST' },
  '706': { state: 'GA', city: 'Augusta', timezone: 'EST' },
  '707': { state: 'CA', city: 'Santa Rosa', timezone: 'PST' },
  '708': { state: 'IL', city: 'Cicero', timezone: 'CST' },
  '712': { state: 'IA', city: 'Sioux City', timezone: 'CST' },
  '713': { state: 'TX', city: 'Houston', timezone: 'CST' },
  '714': { state: 'CA', city: 'Anaheim', timezone: 'PST' },
  '715': { state: 'WI', city: 'Eau Claire', timezone: 'CST' },
  '716': { state: 'NY', city: 'Buffalo', timezone: 'EST' },
  '717': { state: 'PA', city: 'Harrisburg', timezone: 'EST' },
  '718': { state: 'NY', city: 'New York', timezone: 'EST' },
  '719': { state: 'CO', city: 'Colorado Springs', timezone: 'MST' },
  '720': { state: 'CO', city: 'Denver', timezone: 'MST' },
  '724': { state: 'PA', city: 'New Castle', timezone: 'EST' },
  '725': { state: 'NV', city: 'Las Vegas', timezone: 'PST' },
  '727': { state: 'FL', city: 'St. Petersburg', timezone: 'EST' },
  '731': { state: 'TN', city: 'Jackson', timezone: 'CST' },
  '732': { state: 'NJ', city: 'New Brunswick', timezone: 'EST' },
  '734': { state: 'MI', city: 'Ann Arbor', timezone: 'EST' },
  '737': { state: 'TX', city: 'Austin', timezone: 'CST' },
  '740': { state: 'OH', city: 'Newark', timezone: 'EST' },
  '747': { state: 'CA', city: 'Los Angeles', timezone: 'PST' },
  '754': { state: 'FL', city: 'Fort Lauderdale', timezone: 'EST' },
  '757': { state: 'VA', city: 'Virginia Beach', timezone: 'EST' },
  '760': { state: 'CA', city: 'Oceanside', timezone: 'PST' },
  '762': { state: 'GA', city: 'Augusta', timezone: 'EST' },
  '763': { state: 'MN', city: 'Brooklyn Park', timezone: 'CST' },
  '765': { state: 'IN', city: 'Muncie', timezone: 'EST' },
  '769': { state: 'MS', city: 'Jackson', timezone: 'CST' },
  '770': { state: 'GA', city: 'Atlanta suburbs', timezone: 'EST' },
  '772': { state: 'FL', city: 'Port St. Lucie', timezone: 'EST' },
  '773': { state: 'IL', city: 'Chicago', timezone: 'CST' },
  '774': { state: 'MA', city: 'Worcester', timezone: 'EST' },
  '775': { state: 'NV', city: 'Reno', timezone: 'PST' },
  '779': { state: 'IL', city: 'Rockford', timezone: 'CST' },
  '781': { state: 'MA', city: 'Boston suburbs', timezone: 'EST' },
  '785': { state: 'KS', city: 'Topeka', timezone: 'CST' },
  '786': { state: 'FL', city: 'Miami', timezone: 'EST' },
  '801': { state: 'UT', city: 'Salt Lake City', timezone: 'MST' },
  '802': { state: 'VT', city: 'Burlington', timezone: 'EST' },
  '803': { state: 'SC', city: 'Columbia', timezone: 'EST' },
  '804': { state: 'VA', city: 'Richmond', timezone: 'EST' },
  '805': { state: 'CA', city: 'Santa Barbara', timezone: 'PST' },
  '806': { state: 'TX', city: 'Lubbock', timezone: 'CST' },
  '808': { state: 'HI', city: 'Honolulu', timezone: 'HST' },
  '810': { state: 'MI', city: 'Flint', timezone: 'EST' },
  '812': { state: 'IN', city: 'Evansville', timezone: 'EST' },
  '813': { state: 'FL', city: 'Tampa', timezone: 'EST' },
  '814': { state: 'PA', city: 'Erie', timezone: 'EST' },
  '815': { state: 'IL', city: 'Rockford', timezone: 'CST' },
  '816': { state: 'MO', city: 'Kansas City', timezone: 'CST' },
  '817': { state: 'TX', city: 'Fort Worth', timezone: 'CST' },
  '818': { state: 'CA', city: 'Burbank', timezone: 'PST' },
  '828': { state: 'NC', city: 'Asheville', timezone: 'EST' },
  '830': { state: 'TX', city: 'New Braunfels', timezone: 'CST' },
  '831': { state: 'CA', city: 'Salinas', timezone: 'PST' },
  '832': { state: 'TX', city: 'Houston', timezone: 'CST' },
  '843': { state: 'SC', city: 'Charleston', timezone: 'EST' },
  '845': { state: 'NY', city: 'Poughkeepsie', timezone: 'EST' },
  '847': { state: 'IL', city: 'Evanston', timezone: 'CST' },
  '848': { state: 'NJ', city: 'New Brunswick', timezone: 'EST' },
  '850': { state: 'FL', city: 'Tallahassee', timezone: 'EST' },
  '856': { state: 'NJ', city: 'Camden', timezone: 'EST' },
  '857': { state: 'MA', city: 'Boston', timezone: 'EST' },
  '858': { state: 'CA', city: 'San Diego', timezone: 'PST' },
  '859': { state: 'KY', city: 'Lexington', timezone: 'EST' },
  '860': { state: 'CT', city: 'Hartford', timezone: 'EST' },
  '862': { state: 'NJ', city: 'Newark', timezone: 'EST' },
  '863': { state: 'FL', city: 'Lakeland', timezone: 'EST' },
  '864': { state: 'SC', city: 'Greenville', timezone: 'EST' },
  '865': { state: 'TN', city: 'Knoxville', timezone: 'EST' },
  '870': { state: 'AR', city: 'Jonesboro', timezone: 'CST' },
  '872': { state: 'IL', city: 'Chicago', timezone: 'CST' },
  '878': { state: 'PA', city: 'Pittsburgh', timezone: 'EST' },
  '901': { state: 'TN', city: 'Memphis', timezone: 'CST' },
  '903': { state: 'TX', city: 'Tyler', timezone: 'CST' },
  '904': { state: 'FL', city: 'Jacksonville', timezone: 'EST' },
  '906': { state: 'MI', city: 'Marquette', timezone: 'EST' },
  '907': { state: 'AK', city: 'Anchorage', timezone: 'AKST' },
  '908': { state: 'NJ', city: 'Elizabeth', timezone: 'EST' },
  '909': { state: 'CA', city: 'San Bernardino', timezone: 'PST' },
  '910': { state: 'NC', city: 'Fayetteville', timezone: 'EST' },
  '912': { state: 'GA', city: 'Savannah', timezone: 'EST' },
  '913': { state: 'KS', city: 'Kansas City', timezone: 'CST' },
  '914': { state: 'NY', city: 'White Plains', timezone: 'EST' },
  '915': { state: 'TX', city: 'El Paso', timezone: 'MST' },
  '916': { state: 'CA', city: 'Sacramento', timezone: 'PST' },
  '917': { state: 'NY', city: 'New York', timezone: 'EST' },
  '918': { state: 'OK', city: 'Tulsa', timezone: 'CST' },
  '919': { state: 'NC', city: 'Raleigh', timezone: 'EST' },
  '920': { state: 'WI', city: 'Green Bay', timezone: 'CST' },
  '925': { state: 'CA', city: 'Concord', timezone: 'PST' },
  '928': { state: 'AZ', city: 'Yuma', timezone: 'MST' },
  '929': { state: 'NY', city: 'New York', timezone: 'EST' },
  '931': { state: 'TN', city: 'Clarksville', timezone: 'CST' },
  '936': { state: 'TX', city: 'Conroe', timezone: 'CST' },
  '937': { state: 'OH', city: 'Dayton', timezone: 'EST' },
  '938': { state: 'AL', city: 'Huntsville', timezone: 'CST' },
  '940': { state: 'TX', city: 'Denton', timezone: 'CST' },
  '941': { state: 'FL', city: 'Sarasota', timezone: 'EST' },
  '947': { state: 'MI', city: 'Troy', timezone: 'EST' },
  '949': { state: 'CA', city: 'Irvine', timezone: 'PST' },
  '951': { state: 'CA', city: 'Riverside', timezone: 'PST' },
  '952': { state: 'MN', city: 'Bloomington', timezone: 'CST' },
  '954': { state: 'FL', city: 'Fort Lauderdale', timezone: 'EST' },
  '956': { state: 'TX', city: 'Laredo', timezone: 'CST' },
  '959': { state: 'CT', city: 'Hartford', timezone: 'EST' },
  '970': { state: 'CO', city: 'Fort Collins', timezone: 'MST' },
  '971': { state: 'OR', city: 'Portland', timezone: 'PST' },
  '972': { state: 'TX', city: 'Dallas', timezone: 'CST' },
  '973': { state: 'NJ', city: 'Newark', timezone: 'EST' },
  '978': { state: 'MA', city: 'Lowell', timezone: 'EST' },
  '979': { state: 'TX', city: 'College Station', timezone: 'CST' },
  '980': { state: 'NC', city: 'Charlotte', timezone: 'EST' },
  '985': { state: 'LA', city: 'Houma', timezone: 'CST' },
  '989': { state: 'MI', city: 'Saginaw', timezone: 'EST' },
};

// VoIP and Wireless prefixes (common for burners)
const VOIP_PREFIXES = ['200', '300', '400', '500', '521', '522', '523', '524', '525', '526', '527', '528', '529'];

function analyzePhoneNumber(phone: string): PhoneAnalysis {
  // Clean the number
  let cleaned = phone.replace(/\D/g, '');

  // Handle country code
  let countryCode = '1';
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    cleaned = cleaned.slice(1);
  } else if (cleaned.length > 11) {
    countryCode = cleaned.slice(0, cleaned.length - 10);
    cleaned = cleaned.slice(-10);
  }

  const areaCode = cleaned.slice(0, 3);
  const exchange = cleaned.slice(3, 6);
  const subscriber = cleaned.slice(6);

  const isValid = cleaned.length === 10;
  const locationData = US_AREA_CODES[areaCode] || { state: 'Unknown', city: 'Unknown', timezone: 'Unknown' };

  // Check if possible VoIP
  const isPossibleVoIP = VOIP_PREFIXES.includes(exchange.slice(0, 3));

  // Format nicely
  const formatted = isValid
    ? `+${countryCode} (${areaCode}) ${exchange}-${subscriber}`
    : phone;

  return {
    number: cleaned,
    formatted,
    countryCode,
    areaCode,
    lineType: isPossibleVoIP ? 'VoIP/Wireless' : 'Landline/Wireless',
    carrier: 'Unknown', // Would need carrier lookup API
    location: locationData,
    isValid,
    isPossibleMobile: !isPossibleVoIP, // Simplified heuristic
    isPossibleVoIP,
  };
}

// Generate search links for phone number
function generateSearchLinks(phone: string, analysis: PhoneAnalysis) {
  const cleanNumber = analysis.number;
  const formattedNumber = encodeURIComponent(analysis.formatted);

  return {
    google: `https://www.google.com/search?q="${cleanNumber}"`,
    whitepages: `https://www.whitepages.com/phone/${cleanNumber}`,
    truecaller: `https://www.truecaller.com/search/us/${cleanNumber}`,
    spydialer: `https://www.spydialer.com/default.aspx?r=${cleanNumber}`,
    fastpeoplesearch: `https://www.fastpeoplesearch.com/phone/${cleanNumber}`,
    truepeoplesearch: `https://www.truepeoplesearch.com/results?phoneno=${cleanNumber}`,
    facebook: `https://www.facebook.com/search/top?q=${cleanNumber}`,
    linkedin: `https://www.linkedin.com/search/results/all/?keywords=${cleanNumber}`,
    zabasearch: `https://www.zabasearch.com/phone/${cleanNumber}`,
    numberguru: `https://www.numberguru.com/phone/${cleanNumber}`,
    carrier: `https://www.carrierlookup.com/index.php/carrier/${cleanNumber}`,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const phone = (req.query.phone as string) || (req.body?.phone as string);

  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  const analysis = analyzePhoneNumber(phone);

  if (!analysis.isValid) {
    return res.status(400).json({
      error: 'Invalid phone number format',
      analysis,
    });
  }

  const searchLinks = generateSearchLinks(phone, analysis);

  return res.status(200).json({
    phone: analysis.formatted,
    searchedAt: new Date().toISOString(),
    analysis,
    searchLinks,
    tips: [
      'Use Truecaller or Hiya apps for real-time caller ID',
      `Area code ${analysis.areaCode} is from ${analysis.location.city}, ${analysis.location.state}`,
      analysis.isPossibleVoIP ? '⚠️ May be a VoIP/burner number' : 'Likely a standard carrier number',
      `Timezone: ${analysis.location.timezone}`,
    ],
  });
}
