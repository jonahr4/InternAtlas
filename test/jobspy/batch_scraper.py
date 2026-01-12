#!/usr/bin/env python3
"""
Batch Job Scraper - Similar to Admin Page workflow
Searches multiple job types across multiple locations and creates one CSV
Output: company name, job title, actual job URL (no aggregator links)
"""

import csv
from datetime import datetime
from jobspy import scrape_jobs
import pandas as pd


# Configuration
JOB_SEARCHES = [
    "software engineer intern",
    "software engineering intern summer ",
    "software developer intern",
    "project manager intern",
    "product manager intern",
]

LOCATIONS = [
    "Cambridge, MA",
    "Boston, MA",
    "New York, NY",
    "Remote",
    "Massachusetts",
    "NYC",
]

RESULTS_PER_SEARCH = 20
HOURS_OLD = 2000  # Get jobs from a wider timeframe
OUTPUT_COLUMNS = ['company', 'title', 'job_url_direct']  # Only include these in CSV


def print_divider(char="=", length=100):
    """Print a divider line"""
    print(char * length)


def print_job(job, index):
    """Print a single job posting in a formatted way"""
    print(f"\n{index}. {job['title']}")
    print(f"   Company: {job['company']}")
    
    # Handle location - could be 'location' column or 'city'/'state' columns
    if pd.notna(job.get('location')):
        print(f"   Location: {job['location']}")
    elif pd.notna(job.get('city')) or pd.notna(job.get('state')):
        city = job.get('city', 'N/A')
        state = job.get('state', 'N/A')
        print(f"   Location: {city}, {state}")
    else:
        print(f"   Location: N/A")
    
    print(f"   Site: {job['site'].upper()}")
    print(f"   Type: {job.get('job_type', 'N/A')}")
    
    if pd.notna(job.get('min_amount')) and pd.notna(job.get('max_amount')):
        print(f"   Salary: ${job['min_amount']:,.0f} - ${job['max_amount']:,.0f} {job.get('interval', '')}")
    elif pd.notna(job.get('min_amount')):
        print(f"   Salary: ${job['min_amount']:,.0f}+ {job.get('interval', '')}")
    
    print(f"   URL: {job['job_url']}")
    
    if pd.notna(job.get('date_posted')):
        print(f"   Posted: {job['date_posted']}")


def scrape_batch(search_term, location):
    """Scrape jobs for a specific search term and location"""
    try:
        jobs = scrape_jobs(
            site_name=["indeed", "linkedin", "zip_recruiter"],  # Only use reliable US sites
            search_term=search_term,
            location=location,
            distance=50,
            results_wanted=RESULTS_PER_SEARCH,
            hours_old=HOURS_OLD,
            country_indeed='USA',
            verbose=0,  # Quiet mode - only errors
        )
        return jobs
    except Exception as e:
        print(f"   ✗ Error: {e}")
        return pd.DataFrame()


def main():
    """Main batch scraping function"""
    print_divider()
    print("BATCH JOB SCRAPER - INTERNSHIP EDITION")
    print_divider()
    print(f"\nSearching for {len(JOB_SEARCHES)} job types across {len(LOCATIONS)} locations")
    print(f"Total searches: {len(JOB_SEARCHES) * len(LOCATIONS)}")
    print(f"Results per search: {RESULTS_PER_SEARCH}")
    print_divider()
    
    all_jobs = []
    total_found = 0
    search_count = 0
    
    # Loop through each location
    for location in LOCATIONS:
        print(f"\n\n📍 LOCATION: {location}")
        print_divider("-", 100)
        
        # Loop through each job search
        for search_term in JOB_SEARCHES:
            search_count += 1
            print(f"\n[{search_count}/{len(JOB_SEARCHES) * len(LOCATIONS)}] Searching: {search_term}")
            
            jobs = scrape_batch(search_term, location)
            
            if len(jobs) > 0:
                print(f"   ✓ Found {len(jobs)} jobs")
                all_jobs.append(jobs)
                total_found += len(jobs)
                
                # Print first 3 jobs from this search
                for idx, (_, job) in enumerate(jobs.head(3).iterrows(), 1):
                    print_job(job, idx)
                
                if len(jobs) > 3:
                    print(f"\n   ... and {len(jobs) - 3} more jobs")
            else:
                print(f"   ✗ No jobs found")
    
    # Combine all results
    print("\n\n")
    print_divider("=", 100)
    print(f"SEARCH COMPLETE - TOTAL RESULTS: {total_found} jobs")
    print_divider("=", 100)
    
    if all_jobs:
        combined_jobs = pd.concat(all_jobs, ignore_index=True)
        
        # Remove duplicates based on job_url
        original_count = len(combined_jobs)
        combined_jobs = combined_jobs.drop_duplicates(subset=['job_url'], keep='first')
        duplicates_removed = original_count - len(combined_jobs)
        
        print(f"\nUnique jobs after deduplication: {len(combined_jobs)}")
        print(f"Duplicates removed: {duplicates_removed}")
        
        # Print summary statistics
        print("\n" + "="*100)
        print("SUMMARY BY SITE")
        print("="*100)
        site_counts = combined_jobs['site'].value_counts()
        for site, count in site_counts.items():
            print(f"  {site.upper():<15} {count:>4} jobs")
        
        print("\n" + "="*100)
        print("SUMMARY BY LOCATION")
        print("="*100)
        # Handle location - check which columns exist
        if 'location' in combined_jobs.columns:
            location_counts = combined_jobs['location'].value_counts()
            for location, count in location_counts.head(10).items():
                print(f"  {location:<40} {count:>4} jobs")
        elif 'city' in combined_jobs.columns and 'state' in combined_jobs.columns:
            location_counts = combined_jobs.groupby(['city', 'state']).size().sort_values(ascending=False)
            for (city, state), count in location_counts.head(10).items():
                print(f"  {city}, {state:<20} {count:>4} jobs")
        else:
            print("  No location data available")
        
        print("\n" + "="*100)
        print("TOP COMPANIES")
        print("="*100)
        company_counts = combined_jobs['company'].value_counts()
        for company, count in company_counts.head(15).items():
            print(f"  {company:<50} {count:>4} jobs")
        
        # Prepare data for CSV - only company name, job title, and actual company job posting URL
        csv_data = combined_jobs.copy()
        
        # Use job_url_direct (the actual company posting) if available, otherwise fall back to job_url
        if 'job_url_direct' not in csv_data.columns:
            csv_data['job_url_direct'] = csv_data.get('job_url', '')
        
        # Select only the columns we want
        available_columns = [col for col in OUTPUT_COLUMNS if col in csv_data.columns]
        csv_output = csv_data[available_columns]
        
        # Save to CSV
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"internship_jobs_{timestamp}.csv"
        
        csv_output.to_csv(
            filename,
            quoting=csv.QUOTE_NONNUMERIC,
            escapechar="\\",
            index=False
        )
        
        print("\n" + "="*100)
        print(f"✓ Saved {len(csv_output)} unique jobs to {filename}")
        print(f"✓ CSV contains: {', '.join(available_columns)}")
        print("="*100)
        
        # Print all jobs at the end
        print("\n\n" + "="*100)
        print("ALL JOBS LISTING (First 50)")
        print("="*100)
        
        for idx, (_, job) in enumerate(combined_jobs.head(50).iterrows(), 1):
            print_job(job, idx)
        
        if len(combined_jobs) > 50:
            print(f"\n... and {len(combined_jobs) - 50} more jobs (see CSV file for complete list)")
        
    else:
        print("\n✗ No jobs found in any search")


if __name__ == "__main__":
    main()
