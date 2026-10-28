import { calendarPage } from "./calendar.js";
import { profilePage } from "./profile.js";
import * as athlete from "./athlete.js";
import * as coach from "./coach.js";
import * as judge from "./judge.js";
import * as admin from "./admin.js";

export const pages = {
  athlete: { home: athlete.home, profile: profilePage, calendar: calendarPage, results: athlete.results, documents: athlete.documents },
  coach: { home: coach.home, profile: profilePage, athletes: coach.athletes, applications: coach.applications, calendar: calendarPage },
  judge: { home: judge.home, profile: profilePage, category: judge.category, assignments: judge.assignments },
  federation: { home: admin.home, athletes: admin.athletes, competitions: admin.competitions, analytics: admin.analytics, settings: admin.settings },
};
