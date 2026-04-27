export type Category = 'Education' | 'Public Speaking' | 'University Partnership';

export interface Activity {
  name: string;
  category: Category;
  date: string;
  points: number;
}

export interface Employee {
  id: number;
  name: string;
  title: string;
  department: string;
  initials: string;
  color: string;
  activities: Activity[];
}

export interface RankedEmployee extends Employee {
  filteredActivities: Activity[];
  totalPoints: number;
  educationCount: number;
  publicSpeakingCount: number;
  universityCount: number;
  photo?: string;
}

export const CATEGORIES: Category[] = ['Education', 'Public Speaking', 'University Partnership'];
export const YEARS = ['2024', '2025'];
export const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

function yearOf(dateStr: string): string {
  return String(new Date(dateStr).getFullYear());
}

function quarterOf(dateStr: string): string {
  const month = new Date(dateStr).getMonth() + 1;
  if (month <= 3) return 'Q1';
  if (month <= 6) return 'Q2';
  if (month <= 9) return 'Q3';
  return 'Q4';
}

const rawEmployees: Employee[] = [
  {
    id: 1,
    name: 'Alex Mercer',
    title: 'Senior Software Engineer',
    department: 'US.T1.D1.G1',
    initials: 'AM',
    color: '#4a90d9',
    activities: [
      { name: '[REG] Tech Conference: Cloud Architecture', category: 'Public Speaking', date: '2025-05-20', points: 64 },
      { name: '[REG] DevFest 2025: Microservices Deep Dive', category: 'Public Speaking', date: '2025-04-10', points: 64 },
      { name: '[LAB] Lecture "Advanced TypeScript #1"', category: 'Education', date: '2025-03-15', points: 16 },
      { name: '[LAB] Lecture "Advanced TypeScript #2"', category: 'Education', date: '2025-03-15', points: 16 },
      { name: '[LAB] Lecture "Advanced TypeScript #3"', category: 'Education', date: '2025-03-15', points: 16 },
      { name: '[LAB] Mentoring of Jordan Blake', category: 'Education', date: '2025-02-20', points: 64 },
      { name: '[LAB] Mentoring of Casey Ford', category: 'Education', date: '2025-02-20', points: 64 },
      { name: '[LAB] Mentoring of Riley Shaw', category: 'Education', date: '2025-02-20', points: 64 },
      { name: '[REG] Workshop: Scalable Systems', category: 'Public Speaking', date: '2025-01-28', points: 64 },
      { name: '[REG] Meetup: Backend Best Practices', category: 'Public Speaking', date: '2025-01-15', points: 64 },
      { name: '[LAB] Code Review Workshop #1', category: 'Education', date: '2024-11-10', points: 16 },
      { name: '[LAB] Code Review Workshop #2', category: 'Education', date: '2024-11-10', points: 16 },
      { name: '[REG] Annual Engineering Summit', category: 'Public Speaking', date: '2024-10-05', points: 64 },
      { name: '[REG] Open Source Contribution Talk', category: 'Public Speaking', date: '2024-09-20', points: 64 },
      { name: '[LAB] Mentoring of Sam Rivera', category: 'Education', date: '2024-08-14', points: 64 },
      { name: '[REG] Platform Engineering Panel', category: 'Public Speaking', date: '2024-07-22', points: 64 },
      { name: '[UNI] Guest Lecture at State University', category: 'University Partnership', date: '2024-06-18', points: 32 },
    ],
  },
  {
    id: 2,
    name: 'Sandra Kowalski',
    title: 'Group Manager',
    department: 'EU.T2.G3',
    initials: 'SK',
    color: '#7b68ee',
    activities: [
      { name: '[REG] Leadership Summit 2025', category: 'Public Speaking', date: '2025-05-12', points: 64 },
      { name: '[REG] Agile Transformation Conference', category: 'Public Speaking', date: '2025-04-25', points: 64 },
      { name: '[REG] Management Best Practices Meetup', category: 'Public Speaking', date: '2025-03-08', points: 64 },
      { name: '[LAB] Mentoring of Dana Cooper', category: 'Education', date: '2025-02-14', points: 64 },
      { name: '[REG] Team Dynamics Workshop', category: 'Public Speaking', date: '2025-01-20', points: 64 },
      { name: '[LAB] OKR Planning Session', category: 'Education', date: '2024-12-05', points: 16 },
      { name: '[REG] Org Design Forum', category: 'Public Speaking', date: '2024-11-15', points: 64 },
      { name: '[REG] People Manager Roundtable', category: 'Public Speaking', date: '2024-10-30', points: 64 },
      { name: '[LAB] Mentoring of Quinn Patel', category: 'Education', date: '2024-09-10', points: 64 },
      { name: '[REG] Strategic Planning Symposium', category: 'Public Speaking', date: '2024-08-22', points: 64 },
    ],
  },
  {
    id: 3,
    name: 'Victoria Laine',
    title: 'Lead QA Engineer',
    department: 'US.T1.D1.G1.T1',
    initials: 'VL',
    color: '#e87c47',
    activities: [
      { name: '[REG] Quality Gates: Stop, Test, Go!', category: 'Public Speaking', date: '2025-05-14', points: 64 },
      { name: '[LAB] Lecture "JS Workshop #1: Variables"', category: 'Education', date: '2025-04-16', points: 16 },
      { name: '[LAB] Lecture "JS Workshop #2: Loops"', category: 'Education', date: '2025-04-16', points: 16 },
      { name: '[LAB] Lecture "JS Workshop #3: Functions"', category: 'Education', date: '2025-04-16', points: 16 },
      { name: '[LAB] Lecture "JS Workshop #4: Promises"', category: 'Education', date: '2025-04-16', points: 16 },
      { name: '[LAB] Mentoring of Chris Morgan', category: 'Education', date: '2025-04-15', points: 64 },
      { name: '[LAB] Mentoring of Pat Sullivan', category: 'Education', date: '2025-04-15', points: 64 },
      { name: '[LAB] Mentoring of Taylor Nguyen', category: 'Education', date: '2025-04-15', points: 64 },
    ],
  },
  {
    id: 4,
    name: 'Nikolai Petrov',
    title: 'Lead QA Engineer',
    department: 'US.T1.D1.G1.T1',
    initials: 'NP',
    color: '#5c9bd6',
    activities: [
      { name: '[REG] Testing Automation Summit', category: 'Public Speaking', date: '2025-03-20', points: 64 },
      { name: '[LAB] Lecture "Cypress Basics #1"', category: 'Education', date: '2025-02-10', points: 16 },
      { name: '[LAB] Lecture "Cypress Basics #2"', category: 'Education', date: '2025-02-10', points: 16 },
      { name: '[LAB] Lecture "Cypress Basics #3"', category: 'Education', date: '2025-02-10', points: 16 },
      { name: '[LAB] Lecture "Cypress Basics #4"', category: 'Education', date: '2025-02-10', points: 16 },
      { name: '[LAB] Mentoring of Jamie Lee', category: 'Education', date: '2025-01-25', points: 64 },
      { name: '[LAB] Mentoring of Morgan Ellis', category: 'Education', date: '2025-01-25', points: 64 },
    ],
  },
  {
    id: 5,
    name: 'Priya Sharma',
    title: 'Senior Product Manager',
    department: 'IN.T1.D2',
    initials: 'PS',
    color: '#50c878',
    activities: [
      { name: '[REG] Product Strategy Conference', category: 'Public Speaking', date: '2025-04-18', points: 64 },
      { name: '[LAB] Mentoring of Drew Watson', category: 'Education', date: '2025-03-12', points: 64 },
      { name: '[UNI] Guest Lecture at Tech Institute', category: 'University Partnership', date: '2025-02-25', points: 32 },
      { name: '[LAB] Lecture "Product Metrics #1"', category: 'Education', date: '2025-01-30', points: 16 },
      { name: '[LAB] Lecture "Product Metrics #2"', category: 'Education', date: '2025-01-30', points: 16 },
      { name: '[REG] UX Research Symposium', category: 'Public Speaking', date: '2024-11-20', points: 64 },
      { name: '[LAB] Mentoring of Avery Bloom', category: 'Education', date: '2024-10-15', points: 64 },
    ],
  },
  {
    id: 6,
    name: 'Luca Bianchi',
    title: 'DevOps Engineer',
    department: 'IT.T1.D4',
    initials: 'LB',
    color: '#ff6b6b',
    activities: [
      { name: '[REG] KubeCon: Cloud Native Day', category: 'Public Speaking', date: '2025-05-05', points: 64 },
      { name: '[LAB] Lecture "Kubernetes #1: Pods"', category: 'Education', date: '2025-04-08', points: 16 },
      { name: '[LAB] Lecture "Kubernetes #2: Services"', category: 'Education', date: '2025-04-08', points: 16 },
      { name: '[LAB] Mentoring of Jesse Kim', category: 'Education', date: '2025-03-22', points: 64 },
      { name: '[UNI] Infrastructure Workshop for Students', category: 'University Partnership', date: '2025-02-14', points: 32 },
      { name: '[REG] DevOps Days Talk', category: 'Public Speaking', date: '2024-12-10', points: 64 },
      { name: '[LAB] Mentoring of Hayden Cruz', category: 'Education', date: '2024-11-05', points: 64 },
    ],
  },
  {
    id: 7,
    name: 'Mei Zhang',
    title: 'Frontend Engineer',
    department: 'CN.T1.D1.G2',
    initials: 'MZ',
    color: '#d4aa00',
    activities: [
      { name: '[LAB] Lecture "React Hooks #1"', category: 'Education', date: '2025-04-20', points: 16 },
      { name: '[LAB] Lecture "React Hooks #2"', category: 'Education', date: '2025-04-20', points: 16 },
      { name: '[LAB] Lecture "React Hooks #3"', category: 'Education', date: '2025-04-20', points: 16 },
      { name: '[UNI] Frontend Workshop at Design Academy', category: 'University Partnership', date: '2025-03-15', points: 32 },
      { name: '[LAB] Mentoring of River Hayes', category: 'Education', date: '2025-02-28', points: 64 },
      { name: '[REG] React Summit: Accessibility', category: 'Public Speaking', date: '2025-01-22', points: 64 },
      { name: '[LAB] Lecture "CSS Grid Mastery"', category: 'Education', date: '2024-12-03', points: 16 },
    ],
  },
  {
    id: 8,
    name: 'Dmitri Volkov',
    title: 'Data Engineer',
    department: 'RU.T1.D3',
    initials: 'DV',
    color: '#4682b4',
    activities: [
      { name: '[LAB] Lecture "Spark Fundamentals #1"', category: 'Education', date: '2025-03-28', points: 16 },
      { name: '[LAB] Lecture "Spark Fundamentals #2"', category: 'Education', date: '2025-03-28', points: 16 },
      { name: '[REG] Big Data Meetup: Pipelines', category: 'Public Speaking', date: '2025-02-18', points: 64 },
      { name: '[LAB] Mentoring of Skyler Reeves', category: 'Education', date: '2025-01-12', points: 64 },
      { name: '[UNI] Data Science Bootcamp Lecture', category: 'University Partnership', date: '2024-11-25', points: 32 },
      { name: '[LAB] Lecture "dbt Workshop #1"', category: 'Education', date: '2024-10-20', points: 16 },
    ],
  },
  {
    id: 9,
    name: 'Anastasia Miller',
    title: 'QA Engineer',
    department: 'EU.T1.DQA2.T1',
    initials: 'AM',
    color: '#9370db',
    activities: [
      { name: '[LAB] Lecture "Test Automation #1"', category: 'Education', date: '2025-04-05', points: 16 },
      { name: '[LAB] Lecture "Test Automation #2"', category: 'Education', date: '2025-04-05', points: 16 },
      { name: '[LAB] Mentoring of Finley Brooks', category: 'Education', date: '2025-02-10', points: 64 },
    ],
  },
  {
    id: 10,
    name: 'Arthur Davidson',
    title: 'Software Engineer',
    department: 'AS.T1.D3',
    initials: 'AD',
    color: '#20b2aa',
    activities: [
      { name: '[LAB] Lecture "Go Basics #1"', category: 'Education', date: '2025-03-10', points: 16 },
      { name: '[LAB] Lecture "Go Basics #2"', category: 'Education', date: '2025-03-10', points: 16 },
      { name: '[LAB] Lecture "Go Basics #3"', category: 'Education', date: '2025-03-10', points: 16 },
      { name: '[LAB] Mentoring of Cameron Ross', category: 'Education', date: '2025-01-18', points: 64 },
    ],
  },
  {
    id: 11,
    name: 'Stefan Bergmann',
    title: 'Senior Software Engineer',
    department: 'DE.G6',
    initials: 'SB',
    color: '#cd853f',
    activities: [
      { name: '[LAB] Lecture "Clean Architecture #1"', category: 'Education', date: '2025-04-12', points: 16 },
      { name: '[LAB] Lecture "Clean Architecture #2"', category: 'Education', date: '2025-04-12', points: 16 },
      { name: '[LAB] Mentoring of Reese Abbott', category: 'Education', date: '2025-02-05', points: 64 },
      { name: '[UNI] Software Design Lecture at Uni', category: 'University Partnership', date: '2025-01-28', points: 32 },
    ],
  },
  {
    id: 12,
    name: 'Kamil Abdulov',
    title: 'Software Engineer',
    department: 'UZ.T1.D3.T1',
    initials: 'KA',
    color: '#3cb371',
    activities: [
      { name: '[REG] Mentoring of Bogdan Saipov', category: 'Education', date: '2025-11-30', points: 96 },
      { name: '[UNI] Lecture for guest from Najot Talim', category: 'University Partnership', date: '2025-10-14', points: 32 },
      { name: '[REG] Mentoring of Bekhruz Mirzaliev', category: 'Education', date: '2025-08-31', points: 96 },
    ],
  },
  {
    id: 13,
    name: 'Hassan Kholmatov',
    title: 'Senior Software Engineer',
    department: 'UZ.T1.D4.NET',
    initials: 'HK',
    color: '#6495ed',
    activities: [
      { name: '[LAB] Lecture ".NET Fundamentals #1"', category: 'Education', date: '2025-05-08', points: 16 },
      { name: '[LAB] Lecture ".NET Fundamentals #2"', category: 'Education', date: '2025-05-08', points: 16 },
      { name: '[LAB] Lecture ".NET Fundamentals #3"', category: 'Education', date: '2025-05-08', points: 16 },
      { name: '[LAB] Lecture ".NET Fundamentals #4"', category: 'Education', date: '2025-05-08', points: 16 },
      { name: '[UNI] C# Workshop at National University', category: 'University Partnership', date: '2025-04-02', points: 32 },
      { name: '[UNI] Backend Dev Seminar for Students', category: 'University Partnership', date: '2025-03-18', points: 32 },
      { name: '[UNI] Career Guidance Session', category: 'University Partnership', date: '2025-02-22', points: 32 },
    ],
  },
  {
    id: 14,
    name: 'Vitaliy Matveyev',
    title: 'QA Engineer',
    department: 'KG.T1.G1',
    initials: 'VM',
    color: '#ff8c00',
    activities: [
      { name: '[LAB] Lecture "Selenium WebDriver #1"', category: 'Education', date: '2025-04-22', points: 16 },
      { name: '[LAB] Lecture "Selenium WebDriver #2"', category: 'Education', date: '2025-04-22', points: 16 },
      { name: '[LAB] Lecture "Selenium WebDriver #3"', category: 'Education', date: '2025-04-22', points: 16 },
      { name: '[UNI] QA Fundamentals at Tech College', category: 'University Partnership', date: '2025-03-05', points: 32 },
      { name: '[UNI] Testing Strategies for Students', category: 'University Partnership', date: '2025-02-12', points: 32 },
      { name: '[UNI] Career Path in QA Seminar', category: 'University Partnership', date: '2025-01-08', points: 32 },
    ],
  },
];

export function computeEmployees(
  employees: Employee[],
  yearFilter: string,
  quarterFilter: string,
  categoryFilter: string,
): RankedEmployee[] {
  return employees
    .map((emp) => {
      const filtered = emp.activities.filter((act) => {
        if (yearFilter && yearOf(act.date) !== yearFilter) return false;
        if (quarterFilter && quarterOf(act.date) !== quarterFilter) return false;
        if (categoryFilter && act.category !== categoryFilter) return false;
        return true;
      });
      const totalPoints = filtered.reduce((sum, a) => sum + a.points, 0);
      return {
        ...emp,
        filteredActivities: filtered,
        totalPoints,
        educationCount: filtered.filter((a) => a.category === 'Education').length,
        publicSpeakingCount: filtered.filter((a) => a.category === 'Public Speaking').length,
        universityCount: filtered.filter((a) => a.category === 'University Partnership').length,
      };
    })
    .filter((emp) => emp.totalPoints > 0)
    .sort((a, b) => b.totalPoints - a.totalPoints);
}

export default rawEmployees;
