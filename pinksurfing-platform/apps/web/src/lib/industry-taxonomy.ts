/** PinkSurfing industry taxonomy — 19 categories (restricted category omitted). */

export type IndustryCategory = {
  name: string;
  industries: string[];
};

export const ALL_CATEGORIES = 'All categories';
export const ALL_INDUSTRIES = 'All industries';

export const INDUSTRY_TAXONOMY: IndustryCategory[] = [
  {
    name: 'Agriculture & Natural Resources',
    industries: [
      'Agriculture',
      'Farming',
      'Ranching & Livestock',
      'Forestry',
      'Fishing & Aquaculture',
      'Mining',
      'Oil & Gas',
      'Water & Utilities Resources',
    ],
  },
  {
    name: 'Construction & Real Estate',
    industries: [
      'General Contracting',
      'Residential Construction',
      'Commercial Construction',
      'Remodeling & Renovation',
      'Roofing',
      'Electrical Contracting',
      'Plumbing',
      'HVAC',
      'Flooring',
      'Painting',
      'Masonry & Concrete',
      'Landscaping',
      'Property Management',
      'Residential Real Estate',
      'Commercial Real Estate',
      'Real Estate Development',
      'Architecture',
      'Interior Design',
      'Facilities Management',
    ],
  },
  {
    name: 'Manufacturing & Industrial',
    industries: [
      'Consumer Goods Manufacturing',
      'Industrial Equipment',
      'Machinery',
      'Automotive Manufacturing',
      'Aerospace Manufacturing',
      'Electronics Manufacturing',
      'Chemical Manufacturing',
      'Plastics & Rubber',
      'Textiles & Apparel Manufacturing',
      'Food Manufacturing',
      'Beverage Manufacturing',
      'Packaging',
      'Metal Fabrication',
      'Wood Products',
      'Medical Device Manufacturing',
      'Pharmaceutical Manufacturing',
    ],
  },
  {
    name: 'Transportation, Logistics & Supply Chain',
    industries: [
      'Freight & Shipping',
      'Trucking',
      'Last-Mile Delivery',
      'Courier Services',
      'Warehousing',
      'Fulfillment',
      'Supply Chain Management',
      'Import / Export',
      'Customs & Trade Services',
      'Aviation Services',
      'Maritime Services',
      'Moving & Storage',
    ],
  },
  {
    name: 'Retail & Consumer Goods',
    industries: [
      'General Retail',
      'E-commerce Retail',
      'Luxury Goods',
      'Fashion & Apparel',
      'Footwear',
      'Jewelry',
      'Beauty Products',
      'Home Goods',
      'Furniture',
      'Electronics Retail',
      'Toys & Games',
      'Pet Products',
      'Sporting Goods',
      'Auto Parts Retail',
      'Grocery & Specialty Food Retail',
    ],
  },
  {
    name: 'Food, Beverage & Hospitality',
    industries: [
      'Restaurants',
      'Fast Casual',
      'Fine Dining',
      'Cafes & Coffee',
      'Bars & Lounges',
      'Catering',
      'Food Trucks',
      'Bakery & Desserts',
      'Beverage Brands',
      'Hotels',
      'Resorts',
      'Vacation Rentals',
      'Event Venues',
      'Hospitality Services',
      'Nightlife',
    ],
  },
  {
    name: 'Healthcare & Life Sciences',
    industries: [
      'Hospitals',
      'Clinics',
      'Private Practice',
      'Urgent Care',
      'Telehealth',
      'Concierge Medicine',
      'Skilled Nursing',
      'Assisted Living',
      'Home Health',
      'Hospice',
      'Rehab / Physical Therapy',
      'Behavioral Health',
      'Mental Health Services',
      'Dental',
      'Vision / Optometry',
      'Pharmacy',
      'Medical Devices',
      'Biotech',
      'Pharmaceuticals',
      'Healthcare IT',
      'RPM / CCM / Digital Health',
    ],
  },
  {
    name: 'Finance, Insurance & Professional Services',
    industries: [
      'Banking',
      'Lending',
      'Private Credit',
      'Venture Capital',
      'Private Equity',
      'Investment Management',
      'Wealth Management',
      'Insurance',
      'Accounting',
      'Bookkeeping',
      'Tax Services',
      'Legal Services',
      'Compliance',
      'Consulting',
      'Audit',
      'Business Advisory',
      'Risk Management',
    ],
  },
  {
    name: 'Technology & Software',
    industries: [
      'SaaS',
      'Enterprise Software',
      'AI / Machine Learning',
      'Data & Analytics',
      'Cybersecurity',
      'Cloud Infrastructure',
      'Dev Tools',
      'Fintech',
      'Healthtech',
      'Proptech',
      'Edtech',
      'HR Tech',
      'MarTech',
      'AdTech',
      'E-commerce Tech',
      'Marketplaces',
      'Mobile Apps',
      'Web Development',
      'IT Services',
      'Managed Services',
      'Hardware',
      'Semiconductors',
      'Robotics',
      'Blockchain / Web3',
    ],
  },
  {
    name: 'Media, Entertainment & Creative',
    industries: [
      'Film & TV',
      'Music',
      'Podcasting',
      'Publishing',
      'Journalism',
      'Advertising',
      'Marketing Agency',
      'Branding',
      'Public Relations',
      'Social Media',
      'Influencer / Creator',
      'Graphic Design',
      'Photography',
      'Videography',
      'Animation',
      'Gaming',
      'Events & Production',
    ],
  },
  {
    name: 'Education & Training',
    industries: [
      'K-12 Education',
      'Higher Education',
      'Tutoring',
      'Test Prep',
      'Vocational Training',
      'Corporate Training',
      'Coaching',
      'Online Courses',
      'EdTech',
      'Childcare',
      'Early Childhood Education',
    ],
  },
  {
    name: 'Government, Legal & Public Sector',
    industries: [
      'Government Services',
      'Defense',
      'Public Safety',
      'Law Enforcement Support',
      'Civic Tech',
      'Public Administration',
      'Policy / Advocacy',
      'Court / ADR Services',
      'Nonprofit Services',
      'International Development',
    ],
  },
  {
    name: 'Energy, Utilities & Environmental',
    industries: [
      'Power Generation',
      'Solar',
      'Wind',
      'Battery / Storage',
      'Utilities',
      'Waste Management',
      'Recycling',
      'Environmental Services',
      'Water Treatment',
      'Sustainability / ESG',
      'Carbon / Climate Services',
    ],
  },
  {
    name: 'Personal & Local Services',
    industries: [
      'Salons & Barber',
      'Spas & Wellness',
      'Fitness & Gyms',
      'Personal Training',
      'Cleaning Services',
      'Laundry / Dry Cleaning',
      'Repair Services',
      'Security Services',
      'Staffing',
      'Recruiting',
      'Home Services',
      'Pet Services',
      'Funeral Services',
      'Lifestyle Services',
    ],
  },
  {
    name: 'Automotive, Marine & Mobility',
    industries: [
      'Auto Sales',
      'Auto Repair',
      'Auto Detailing',
      'Fleet Services',
      'Auto Parts',
      'EV Services',
      'Motorcycle',
      'Marine / Boating',
      'RV / Trailer',
      'Mobility Services',
      'Car Rental',
    ],
  },
  {
    name: 'Telecommunications & Connectivity',
    industries: [
      'Telecom Carriers',
      'Internet Service Providers',
      'Wireless Services',
      'Network Infrastructure',
      'Communications Equipment',
      'Unified Communications',
    ],
  },
  {
    name: 'Business Services',
    industries: [
      'BPO / Outsourcing',
      'Virtual Assistant Services',
      'Call Centers',
      'Procurement Services',
      'Printing',
      'Document Services',
      'Merchant Services',
      'Payment Processing',
      'Franchise Services',
      'Office Services',
    ],
  },
  {
    name: 'Religion, Community & Social Organizations',
    industries: [
      'Religious Organizations',
      'Community Organizations',
      'Charities',
      'Clubs & Membership Groups',
      'Social Impact Ventures',
      'Associations',
    ],
  },
  {
    name: 'Other',
    industries: ['Other', 'Multi-Industry', 'Undisclosed', 'Not Sure Yet'],
  },
];

export function industryCategoryNames(): string[] {
  return [ALL_CATEGORIES, ...INDUSTRY_TAXONOMY.map((c) => c.name)];
}

export function industriesForCategory(category: string): string[] {
  if (category === ALL_CATEGORIES) {
    return [ALL_INDUSTRIES, ...allSpecificIndustries()];
  }
  const found = INDUSTRY_TAXONOMY.find((c) => c.name === category);
  return found ? [ALL_INDUSTRIES, ...found.industries] : [ALL_INDUSTRIES];
}

export function allSpecificIndustries(): string[] {
  const set = new Set<string>();
  for (const cat of INDUSTRY_TAXONOMY) {
    for (const ind of cat.industries) set.add(ind);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function categoryForIndustry(industry: string): string | undefined {
  for (const cat of INDUSTRY_TAXONOMY) {
    if (cat.industries.includes(industry)) return cat.name;
  }
  return undefined;
}

export function matchesIndustryFilter(
  person: { industry: string; industryCategory?: string },
  filters: { industryCategory: string; industry: string }
): boolean {
  if (filters.industry !== ALL_INDUSTRIES && person.industry !== filters.industry) {
    return false;
  }
  if (filters.industryCategory !== ALL_CATEGORIES) {
    const cat = person.industryCategory ?? categoryForIndustry(person.industry);
    if (cat !== filters.industryCategory) return false;
  }
  return true;
}

export function defaultIndustryFilters(): {
  industryCategory: string;
  industry: string;
} {
  return { industryCategory: ALL_CATEGORIES, industry: ALL_INDUSTRIES };
}
