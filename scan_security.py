#!/usr/bin/env python3
import os
import re
import subprocess
import sys
from pathlib import Path

# ANSI colors for nice terminal output
RESET = "\033[0m"
BOLD = "\033[1m"
RED = "\033[31m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
BLUE = "\033[34m"
CYAN = "\033[36m"

# Directories to scan
WORKSPACE_BASE = Path("/run/media/zeus/6TB-1/__GITHUB NUC")
REPOS = [
    "__auto-dash",
    "_ct-ACE",
    "_ct-FIR",
    "_ct-KING",
    "_ct-MATRIX",
    "_ct-MMR",
    "_ct-POST",
    "_ct-QUIZ",
    "_ct-WEA"
]

# File types to ignore (binary, build, lockfiles)
IGNORE_EXTENSIONS = {
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.mp4', '.pdf', '.zip', 
    '.avif', '.webp', '.woff', '.woff2', '.eot', '.ttf', '.mp3', '.wav',
    '.sqlite', '.db', '.lock'
}

# Directories to skip
IGNORE_DIRS = {
    'node_modules', '.git', '.vscode', '.idea', 'dist', 'build', 'out', 'tmp'
}

# Regular expressions for secrets scanning
SECRET_PATTERNS = {
    "Private Key": re.compile(r"-----BEGIN (?:RSA |EC |PGP )?PRIVATE KEY-----", re.IGNORECASE),
    "Google API Key": re.compile(r"AIzaSy[a-zA-Z0-9_\-]{33}"),
    "AWS Access Key": re.compile(r"AKIA[0-9A-Z]{16}"),
    "Generic Token/Secret": re.compile(
        r"(?:secret|token|password|passwd|auth|api_key|apikey|client_secret)\s*[:=]\s*['\"]([a-zA-Z0-9_\-\.\+/=]{16,})['\"]", 
        re.IGNORECASE
    ),
    "Firebase Config Secret": re.compile(r"['\"]apiKey['\"]\s*:\s*['\"]([^'\"]{20,})['\"]", re.IGNORECASE),
    "Database URL with Password": re.compile(r"mongodb(?:\+srv)?://[^:]+:([^@]+)@", re.IGNORECASE)
}

# Exclude false positives (known common non-sensitive strings)
FALSE_POSITIVES = {
    "your-api-key", "your_api_key", "your-secret", "placeholder", 
    "true", "false", "null", "undefined", "none", "void"
}

def scan_file_for_secrets(file_path):
    findings = []
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            for line_no, line in enumerate(f, 1):
                # Skip excessively long lines (often minified JS files)
                if len(line) > 1000:
                    continue
                for pattern_name, pattern in SECRET_PATTERNS.items():
                    matches = pattern.findall(line)
                    for match in matches:
                        # Extract the match string if group matches exist
                        match_str = match if isinstance(match, str) else match[0] if isinstance(match, tuple) else line
                        # Skip if it is a known false positive placeholder
                        if any(fp in match_str.lower() for fp in FALSE_POSITIVES):
                            continue
                        # Basic entropy/sanity check to prevent matching random short HTML ids or Tailwind classes
                        if len(match_str) < 6:
                            continue
                        
                        findings.append({
                            "line": line_no,
                            "type": pattern_name,
                            "snippet": line.strip()[:100],
                            "file": str(file_path)
                        })
    except Exception as e:
        pass
    return findings

def check_git_tracked_secrets(repo_path):
    findings = []
    env_files = [".env", ".env.local", ".env.development", ".env.production"]
    for env in env_files:
        path = repo_path / env
        if path.exists():
            # Check if tracked in git
            try:
                result = subprocess.run(
                    ["git", "ls-files", "--error-unmatch", env],
                    cwd=repo_path,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True
                )
                if result.returncode == 0:
                    findings.append({
                        "file": env,
                        "issue": "Sensitive environment file is actively tracked in Git",
                        "severity": "High"
                    })
            except Exception:
                pass
    return findings

def check_npm_audit(repo_path):
    if not (repo_path / "package.json").exists():
        return None
    
    # Check if npm is available
    try:
        subprocess.run(["npm", "--version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except FileNotFoundError:
        return "NPM is not installed"
    
    try:
        result = subprocess.run(
            ["npm", "audit", "--json"],
            cwd=repo_path,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        # npm audit returns exit code > 0 if vulnerabilities are found
        return result.stdout
    except Exception as e:
        return f"Error running npm audit: {str(e)}"

def run_security_scan():
    print(f"{BOLD}{BLUE}==============================================={RESET}")
    print(f"{BOLD}{BLUE}       Mono-Repo & Local Directory Security Scan{RESET}")
    print(f"{BOLD}{BLUE}==============================================={RESET}\n")

    report_markdown = []
    report_markdown.append("# Mono-Repo Security Scan Report")
    report_markdown.append(f"Generated at: 2026-05-20\n")

    total_secrets = 0
    total_tracked_env = 0
    total_npm_issues = 0

    for repo_name in REPOS:
        repo_path = WORKSPACE_BASE / repo_name
        if not repo_path.exists():
            print(f"{YELLOW}[!] Repository path {repo_path} does not exist. Skipping...{RESET}")
            continue

        print(f"{BOLD}{CYAN}Scanning Repository: {repo_name}{RESET}")
        report_markdown.append(f"## Repo: `{repo_name}`")
        
        # 1. Scan for Git Tracked Environment Files
        tracked_env_findings = check_git_tracked_secrets(repo_path)
        if tracked_env_findings:
            print(f"  {RED}[!] Git Secrets Warning:{RESET}")
            for finding in tracked_env_findings:
                print(f"    - {RED}{finding['issue']} ({finding['file']}){RESET}")
                report_markdown.append(f"- **[HIGH]** Tracked environment file: `{finding['file']}`")
                total_tracked_env += 1
        
        # 2. Scan Files for Hardcoded Secrets
        secret_findings = []
        for root, dirs, files in os.walk(repo_path):
            # Prune ignored directories in place
            dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
            
            for file in files:
                file_path = Path(root) / file
                if file_path.suffix.lower() in IGNORE_EXTENSIONS:
                    continue
                
                # Skip package-lock.json and node_modules explicitly
                if file in ("package-lock.json", "yarn.lock", "pnpm-lock.yaml"):
                    continue

                file_secrets = scan_file_for_secrets(file_path)
                secret_findings.extend(file_secrets)
        
        if secret_findings:
            print(f"  {YELLOW}[!] Potential Hardcoded Secrets Found ({len(secret_findings)}):{RESET}")
            for sf in secret_findings:
                rel_path = Path(sf['file']).relative_to(repo_path)
                print(f"    - {sf['type']} in {rel_path}:{sf['line']}")
                print(f"      Code: {sf['snippet']}")
                report_markdown.append(f"- **[MODERATE]** Potential {sf['type']} in `{rel_path}` at line {sf['line']}")
                total_secrets += 1
        else:
            print(f"  {GREEN}[✓] No hardcoded secrets detected{RESET}")
        
        # 3. Scan for npm audits
        if (repo_path / "package.json").exists():
            print(f"  {BLUE}[i] Running NPM Audit...{RESET}")
            audit_result = check_npm_audit(repo_path)
            if audit_result == "NPM is not installed":
                print(f"    {YELLOW}[!] Could not run npm audit: npm command is not installed.{RESET}")
                report_markdown.append(f"- **[INFO]** Could not run `npm audit` (npm command not found).")
            elif isinstance(audit_result, str):
                # Simple parsing of npm audit JSON output or text
                import json
                try:
                    audit_data = json.loads(audit_result)
                    vulnerabilities = audit_data.get("metadata", {}).get("vulnerabilities", {})
                    vuln_summary = ", ".join(f"{k}: {v}" for k, v in vulnerabilities.items() if v > 0)
                    if vuln_summary:
                        print(f"    {RED}[!] npm vulnerabilities found: {vuln_summary}{RESET}")
                        report_markdown.append(f"- **[VULNERABILITY]** npm audit found: {vuln_summary}")
                        total_npm_issues += 1
                    else:
                        print(f"    {GREEN}[✓] npm audit clean (0 vulnerabilities){RESET}")
                        report_markdown.append(f"- [✓] npm audit clean (0 vulnerabilities)")
                except json.JSONDecodeError:
                    # Fallback to plain text output or error
                    if "vulnerabilities" in audit_result or "severity" in audit_result:
                        print(f"    {RED}[!] npm vulnerabilities found (raw output matches patterns){RESET}")
                        report_markdown.append(f"- **[VULNERABILITY]** npm audit found issues (see console details)")
                        total_npm_issues += 1
                    else:
                        print(f"    {GREEN}[✓] npm audit clean{RESET}")
                        report_markdown.append(f"- [✓] npm audit clean")
        else:
            report_markdown.append(f"- [i] Non-npm repository.")
            
        print()
        report_markdown.append("")

    # Summary
    print(f"{BOLD}{BLUE}==============================================={RESET}")
    print(f"{BOLD}Scan Complete!{RESET}")
    print(f"  - Tracked Env Files: {total_tracked_env}")
    print(f"  - Hardcoded Secrets: {total_secrets}")
    print(f"  - Vulnerable Packages: {total_npm_issues}")
    print(f"{BOLD}{BLUE}==============================================={RESET}\n")

    report_markdown.append("## Scan Summary")
    report_markdown.append(f"- **Tracked Environment Files**: {total_tracked_env}")
    report_markdown.append(f"- **Hardcoded Secrets**: {total_secrets}")
    report_markdown.append(f"- **Vulnerable npm Repositories**: {total_npm_issues}")

    # Write report
    report_path = WORKSPACE_BASE / "security_scan_report.md"
    try:
        with open(report_path, "w", encoding="utf-8") as f:
            f.write("\n".join(report_markdown))
        print(f"Detailed Markdown report saved to: {report_path}")
    except Exception as e:
        print(f"Could not write Markdown report: {e}")

if __name__ == "__main__":
    run_security_scan()
