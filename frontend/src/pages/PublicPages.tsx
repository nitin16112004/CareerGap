import { ArrowRight, Bell, ChartNoAxesColumnIncreasing, FileText, FileUp, Map, ScanText, Target } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Logo } from "../components/auth/Logo";
import "./public-pages.css";

const features = [
  { icon: FileUp, title: "Resume-first onboarding", description: "Upload a PDF or DOCX to start your career profile." },
  { icon: ScanText, title: "Resume parsing", description: "Review and correct details extracted from your resume before saving your profile." },
  { icon: Target, title: "Skill gap analysis", description: "Compare your skills with the requirements for a target role and see which gaps to address first." },
  { icon: Map, title: "Personalized roadmap", description: "Turn your missing skills into weekly tasks and track them as you learn." },
  { icon: Bell, title: "Weekly reminders", description: "Set your preferences and see reminders about pending tasks and progress." },
  { icon: FileText, title: "ATS resume builder", description: "Create an editable, role-focused resume and export it as PDF or DOCX." },
  { icon: ChartNoAxesColumnIncreasing, title: "Progress dashboard", description: "See your skill match, roadmap progress, and next action in one place." },
];

const steps = [
  { title: "Upload and review", description: "Start with a resume and confirm the details you want to keep." },
  { title: "Choose a target role", description: "Compare your current skills with the role's requirements." },
  { title: "Follow your roadmap", description: "Work through your weekly plan and update your resume as you go." },
];

const questions = [
  { question: "What resume files can I upload?", answer: "PDF and DOCX files up to 5 MB." },
  { question: "What if the app reads part of my resume incorrectly?", answer: "You can correct or complete the extracted details before saving your profile." },
  { question: "Can I edit a generated resume?", answer: "Yes. You can edit and preview the content before exporting it as a PDF or DOCX." },
];

export const PublicLayout = (): JSX.Element => (
  <div className="public-site">
    <header className="public-header">
      <Logo />
      <nav className="public-nav" aria-label="Main navigation">
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/features">Features</NavLink>
        <NavLink to="/login">Sign in</NavLink>
        <Link className="button button-primary" to="/signup">Get started</Link>
      </nav>
    </header>
    <Outlet />
    <footer className="public-footer">
      <Logo />
      <Link to="/features">Explore features</Link>
      <Link to="/login">Sign in</Link>
    </footer>
  </div>
);

export const LandingPage = (): JSX.Element => (
  <main>
    <section className="public-hero public-container">
      <div>
        <h1>Build a job-ready career path with AI</h1>
        <p>Upload your resume, find missing skills, and follow a learning plan for your target role. Build an ATS-friendly resume from the experience you already have.</p>
        <div className="public-actions">
          <Link className="button button-primary" to="/signup">Get started <ArrowRight size={18} aria-hidden="true" /></Link>
          <Link className="button button-secondary" to="/features">View features</Link>
        </div>
      </div>
      <aside className="public-preview" aria-label="Example dashboard for a backend developer">
        <h2>Example plan</h2>
        <p>Backend developer</p>
        <dl>
          <div><dt>Skill match</dt><dd>58%</dd></div>
          <div><dt>Roadmap progress</dt><dd>35%</dd></div>
        </dl>
        <p>Skills to build</p>
        <ul><li>Node.js</li><li>Redis</li><li>System design</li></ul>
      </aside>
    </section>
    <section className="public-section public-container">
      <h2>See what to learn next</h2>
      <p>Job descriptions list dozens of skills. CareerGuid AI shows how your experience compares with one role and gives you tasks to work through the gaps.</p>
      <ol className="public-grid">
        {steps.map(({ title, description }) => <li key={title}><h3>{title}</h3><p>{description}</p></li>)}
      </ol>
    </section>
    <section className="public-section public-container">
      <h2>Tools for each step</h2>
      <FeatureList />
      <Link className="text-link" to="/features">Explore all features <ArrowRight size={16} aria-hidden="true" /></Link>
    </section>
    <section className="public-section public-container public-faq">
      <h2>Frequently asked questions</h2>
      {questions.map(({ question, answer }) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
    </section>
  </main>
);

const FeatureList = (): JSX.Element => (
  <ul className="public-grid">
    {features.map(({ icon: Icon, title, description }) => (
      <li key={title}><Icon size={22} aria-hidden="true" /><h3>{title}</h3><p>{description}</p></li>
    ))}
  </ul>
);

export const FeaturesPage = (): JSX.Element => (
  <main className="public-section public-container">
    <h1>CareerGuid AI features</h1>
    <p>Start with your resume and build a plan tailored to your next role.</p>
    <FeatureList />
    <Link className="button button-primary" to="/signup">Start your career analysis <ArrowRight size={18} aria-hidden="true" /></Link>
  </main>
);

export const NotFoundPage = (): JSX.Element => (
  <main className="public-section public-container">
    <h1>Page not found</h1>
    <p>Check the address or return to the homepage.</p>
    <Link className="button button-primary" to="/">Go to homepage</Link>
  </main>
);
