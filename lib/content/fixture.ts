/** v7 content fixture, copied from docs/mockups/v7/content.js. Streams build against
 *  this until getContent() reads the DB; it stays as the fallback/test fixture.
 *  {{placeholders}} are facts the owner still has to fill — never invent them. */
import type { Content } from "./types";

export const fixture: Content = {
  name: "Rithvik Praveen Kumar",
  first: "Rithvik",
  last: "Praveen Kumar",
  initials: "RPK",
  role: "Software and AI engineer",
  status: "CS + Math at Purdue · open to SWE and AI internships",
  line: "I build brain-computer interfaces, computer vision, and ML small enough for a microcontroller.",
  thesis: ["Brain signals", "Faces in video", "Models on microcontrollers"],
  about: [
    "I study computer science and math at Purdue. I like work that sits close to hardware: reading brain signals, finding people in video, and fitting models onto microcontrollers.",
    "Right now I research TinyML at Purdue's Snowball Lab. Before that I built a RAG learning platform for a non-profit serving 500+ learners, and spent two years teaching kids to code through game development.",
  ],
  now: { city: "San Francisco", tz: "America/Los_Angeles", building: "rithvik.ai", researching: "TinyML on Edge Impulse", learning: "Energy-harvesting sensors" },
  places: [
    { key: "home", city: "Boston", tz: "America/New_York", lat: 42.36, lng: -71.06 },
    { key: "school", city: "West Lafayette", tz: "America/Indiana/Indianapolis", lat: 40.43, lng: -86.91 },
    { key: "now", city: "San Francisco", tz: "America/Los_Angeles", lat: 37.77, lng: -122.42 },
  ],
  links: {
    email: "rithvikpkx@gmail.com",
    github: "https://github.com/rithvikpkx",
    linkedin: "https://www.linkedin.com/", // {{owner: LinkedIn URL}}
  },
  projects: [
    { slug: "mind-controlled-arm", title: "Mind-Controlled Robotic Arm", headline: "A robotic arm driven by thought alone", kind: "BCI / Hardware", icon: "cpu", ctx: "NeuroSky EEG headset and an Arduino",
      desc: ["Drives a robotic arm from thought alone with a NeuroSky EEG headset and an Arduino.", "Built as a foundation for translating intent into sign-language gestures for differently-abled users."],
      tags: ["NeuroSky", "Arduino", "C++", "Python", "EEG"], links: { Demo: "https://www.youtube.com/watch?v=W8EzUuWgi4o" } },
    { slug: "boilerframe", title: "BoilerFrame", headline: "Finds every frame a person appears in a video", kind: "Computer vision", icon: "crosshair", ctx: "Full-stack MERN app on AWS Rekognition",
      desc: ["Ingests reference images and footage, then runs a facial-recognition pipeline.", "Returns every timestamp the person appears.", "Built on the MERN stack with AWS Rekognition."],
      tags: ["React", "Express", "Node.js", "MongoDB", "AWS"], links: { GitHub: "https://github.com/rithvikpkx/BoilerFrame" } },
    { slug: "eeg-thought-prediction", title: "Left/Right Thought Prediction", headline: "Classifies left, right and neutral thoughts from EEG", kind: "BCI", icon: "activity", ctx: "16-channel OpenBCI headset",
      desc: ["Classifies left, right and neutral thoughts from 16-channel EEG captured with an OpenBCI headset.", "Pairs a stimulus-display program with TensorFlow models; ongoing work is dataset collection and accuracy."],
      tags: ["Python", "OpenBCI", "TensorFlow", "Keras", "EEG"], links: { GitHub: "https://github.com/rithvikpkx/OpenBCI-Project" } },
    { slug: "citizen-happiness", title: "Predicting Citizen Happiness", headline: "Modeled how public spending tracks happiness", kind: "ML research", icon: "trending-up", ctx: "Columbia University SHAPE, team of four",
      desc: ["Lasso model correlating national spending on military, education and health with reported happiness.", "Built by a four-person team during Columbia University's SHAPE program in New York."],
      tags: ["Python", "Pandas", "scikit-learn"], links: { GitHub: "https://github.com/rithvikpkx/HappinessProjectSHAPE", Demo: "https://www.youtube.com/watch?v=eBzE83IjDZM" } },
    { slug: "qrify", title: "QRIfy", headline: "Turns any text into a downloadable QR code", kind: "Web app", icon: "grip", ctx: "Python and Segno on AWS EC2",
      desc: ["Turns user text into a downloadable QR code.", "Python and Segno backend, hand-rolled frontend, deployed on an AWS EC2 instance."],
      tags: ["Python", "JavaScript", "AWS"], links: { GitHub: "https://github.com/rithvikpkx/QRCode_Project" } },
    { slug: "habitat-humanity-ecomm", title: "Habitat for Humanity E-Commerce", headline: "One-click listings to Marketplace and eBay", kind: "Volunteer", icon: "users", ctx: "Google Apps Script tool for a non-profit",
      desc: ["Inventory tool that posts items to Facebook Marketplace and eBay from one interface.", "Wrote the training materials and onboarded staff to the new workflow."],
      tags: ["Google Apps Script", "JavaScript"], links: {} },
  ],
  experience: [
    { slug: "tinyml-research", role: "Undergraduate Researcher, TinyML", org: "Snowball Lab, Purdue University", when: "2026 – now", where: "West Lafayette, IN",
      desc: ["Optimizing and deploying small ML models onto low-power embedded hardware with Edge Impulse, under Prof. Qiuyue \"Shirley\" Xue.", "Investigating piezoelectric microphones that act as both sensors and energy sources for on-device models."],
      tags: ["TinyML", "Edge Impulse", "Python", "C++"] },
    { slug: "hack-the-future", role: "Software Developer", org: "Hack The Future @ Purdue", when: "2025 – 2026", where: "West Lafayette, IN",
      desc: ["Built a full-stack, AI-powered RAG learning platform for a non-profit serving 500+ underserved learners.", "Wired the LLM workflow and vector retrieval; added AI-generated quizzes and assignments."],
      tags: ["React", "Node.js", "Express", "MongoDB", "Ollama", "RAG"] },
    { slug: "code-ninjas-ir", role: "Investor Relations Chair", org: "Code Ninjas", when: "2025", where: "Northborough, MA",
      desc: ["Analyzed revenue, costs and margins to surface trends; delivered quarterly reports."], tags: ["Financial analysis", "Reporting"] },
    { slug: "code-ninjas-sensei", role: "Code Sensei", org: "Code Ninjas", when: "2023 – 2025", where: "Northborough, MA",
      desc: ["Taught programming through game development to 40 students aged 5 to 12.", "Organized hackathons and built personalized skill paths with parents."], tags: ["JavaScript", "C#", "Teaching"] },
  ],
  education: { school: "Purdue University", degree: "B.S. Computer Science + Mathematics", focus: "Software Engineering · AI/ML", grad: "Expected {{graduation}}", logo: "purdue.png" },
  stack: {
    Languages: ["Python", "JavaScript", "TypeScript", "C++", "C#", "SQL"],
    Frameworks: ["React", "Next.js", "Node.js", "Express", "TensorFlow", "Keras", "scikit-learn", "Pandas"],
    "Infra and data": ["AWS", "MongoDB", "Supabase", "Vercel", "Cloudflare", "Google Apps Script"],
    "AI and hardware": ["RAG", "Ollama", "Edge Impulse", "TinyML", "OpenBCI", "NeuroSky", "Arduino", "EEG"],
  },
  faq: [
    ["When can you start?", "I'm open to SWE and AI internships for {{season and dates}}."],
    ["Where are you based?", "West Lafayette, Indiana during the school year. I'm in San Francisco right now."],
    ["What kind of role fits best?", "Software engineering or ML work, especially close to hardware: brain-computer interfaces, computer vision and TinyML."],
    ["Can I see code?", "Most projects link to their repositories; the rest are on GitHub at github.com/rithvikpkx."],
    ["Work authorization?", "{{owner to confirm}}"],
  ],
  numbers: [
    ["500+", "learners on the RAG platform I built"],
    ["40", "kids taught to code through games"],
    ["16", "EEG channels decoded into left, right and neutral"],
    ["6", "projects, from headsets to the cloud"],
  ],
  log: [["Aug 14", "feat", "lightweight agentic actions in the chat"], ["Aug 14", "fix", "make the favicon acceptable to Google search results"], ["Aug 14", "feat", "semantic repeat detection + runtime temperature knob"], ["Aug 14", "feat", "follow-up suggestions + transcript export"], ["Aug 11", "fix", "rate-limit /api/chat, close contact relay, fix OG images"], ["Aug 11", "fix", "close public write path to site content"]],
};
