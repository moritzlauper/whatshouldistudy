import type { JobSource } from './types.ts'

/** Public employer pages and the public feeds embedded by their own job searches.
 * SmartRecruiters' central API remains excluded by its robots.txt. */
export const JOB_SOURCES: JobSource[] = [
  { id: 'Swissquote', name: 'Swissquote', url: 'https://careers.smartrecruiters.com/Swissquote/', sector: 'finance' },
  { id: 'SwissMedicalNetwork1', name: 'Swiss Medical Network', url: 'https://careers.smartrecruiters.com/SwissMedicalNetwork1/', sector: 'health' },
  { id: 'Nexthink', name: 'Nexthink', url: 'https://careers.smartrecruiters.com/Nexthink/', sector: 'technology' },
  { id: 'Coop', name: 'Coop-Gruppe', url: 'https://jobs.coopjobs.ch/', format: 'prospective', feedUrl: 'https://ohws.prospective.ch/public/v1/medium/1000103/jobs' },
  { id: 'Bund', name: 'Bundesverwaltung', url: 'https://www.jobs.admin.ch/', sector: 'public', format: 'prospective', feedUrl: 'https://ohws.prospective.ch/public/v1/medium/1000624/jobs' },
  { id: 'SBB', name: 'SBB', url: 'https://company.sbb.ch/de/jobs-karriere/jobs/offene-stellen.html', sector: 'transport', format: 'sbb', feedUrl: 'https://company.sbb.ch/content/internet/corporate/de/jobs-karriere/jobs/job-suche/jcr:content/parmain/jobfilter.results.json' },
]

export function jobSector(job: { sourceId: string; sector?: JobSource['sector'] }) {
  return job.sector ?? JOB_SOURCES.find((source) => source.id === job.sourceId)?.sector
}
