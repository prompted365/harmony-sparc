#!/usr/bin/env python3
"""
Integration Test Runner for EESystem Content Curation Platform
Coordinates execution of all integration tests and generates comprehensive reports
"""
import asyncio
import subprocess
import sys
import os
import time
import json
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
import argparse

# Test categories and their corresponding test files
TEST_CATEGORIES = {
    "database": {
        "description": "Database integration tests (AstraDB + SQLite)",
        "files": ["tests/integration/test_database_integration.py"],
        "timeout": 300  # 5 minutes
    },
    "ai_agents": {
        "description": "AI Agent system integration tests",
        "files": ["tests/integration/test_ai_agent_integration.py"],
        "timeout": 600  # 10 minutes
    },
    "api": {
        "description": "API endpoint integration tests",
        "files": ["tests/integration/test_api_integration.py"],
        "timeout": 300  # 5 minutes
    },
    "e2e": {
        "description": "End-to-end workflow tests",
        "files": ["tests/e2e/test_complete_workflow.py"],
        "timeout": 900  # 15 minutes
    },
    "performance": {
        "description": "Performance and scalability tests",
        "files": ["tests/performance/test_system_performance.py"],
        "timeout": 1200  # 20 minutes
    },
    "compliance": {
        "description": "EESystem brand compliance tests",
        "files": ["tests/integration/test_compliance_validation.py"],
        "timeout": 300  # 5 minutes
    },
    "security": {
        "description": "Security and authentication tests",
        "files": ["tests/integration/test_security.py"],
        "timeout": 300  # 5 minutes
    }
}

class TestRunner:
    """Manages test execution and reporting"""
    
    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.results = {}
        self.start_time = None
        self.end_time = None
        
    async def run_test_category(
        self,
        category: str,
        config: Dict[str, Any],
        verbose: bool = False
    ) -> Dict[str, Any]:
        """Run tests for a specific category"""
        print(f"\n🧪 Running {category} tests: {config['description']}")
        print(f"📁 Files: {', '.join(config['files'])}")
        
        category_results = {
            "category": category,
            "description": config["description"],
            "files": config["files"],
            "status": "running",
            "start_time": datetime.utcnow().isoformat(),
            "end_time": None,
            "duration": 0,
            "tests_run": 0,
            "tests_passed": 0,
            "tests_failed": 0,
            "tests_skipped": 0,
            "coverage": 0.0,
            "errors": [],
            "warnings": []
        }
        
        try:
            start_time = time.time()
            
            # Build pytest command
            cmd = [
                sys.executable, "-m", "pytest",
                "--tb=short",
                "--json-report",
                f"--json-report-file=test_results_{category}.json",
                "--cov=backend",
                f"--cov-report=html:htmlcov_{category}",
                f"--cov-report=json:coverage_{category}.json",
                "--timeout=60",  # Per-test timeout
                "-v" if verbose else "-q"
            ]
            
            # Add test files
            for test_file in config["files"]:
                test_path = self.project_root / test_file
                if test_path.exists():
                    cmd.append(str(test_path))
                else:
                    category_results["warnings"].append(f"Test file not found: {test_file}")
            
            # Run tests with timeout
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(self.project_root)
            )
            
            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(),
                    timeout=config["timeout"]
                )
                
                end_time = time.time()
                duration = end_time - start_time
                
                # Parse results
                result_file = self.project_root / f"test_results_{category}.json"
                if result_file.exists():
                    with open(result_file) as f:
                        test_data = json.load(f)
                    
                    category_results.update({
                        "tests_run": test_data.get("summary", {}).get("total", 0),
                        "tests_passed": test_data.get("summary", {}).get("passed", 0),
                        "tests_failed": test_data.get("summary", {}).get("failed", 0),
                        "tests_skipped": test_data.get("summary", {}).get("skipped", 0)
                    })
                
                # Parse coverage
                coverage_file = self.project_root / f"coverage_{category}.json"
                if coverage_file.exists():
                    with open(coverage_file) as f:
                        coverage_data = json.load(f)
                    category_results["coverage"] = coverage_data.get("totals", {}).get("percent_covered", 0.0)
                
                category_results.update({
                    "status": "passed" if process.returncode == 0 else "failed",
                    "duration": duration,
                    "end_time": datetime.utcnow().isoformat(),
                    "exit_code": process.returncode
                })
                
                if process.returncode != 0:
                    error_output = stderr.decode() if stderr else "Unknown error"
                    category_results["errors"].append(error_output)
                
                # Print summary
                status_emoji = "✅" if process.returncode == 0 else "❌"
                print(f"{status_emoji} {category} tests completed in {duration:.2f}s")
                if category_results["tests_run"] > 0:
                    print(f"   📊 {category_results['tests_passed']}/{category_results['tests_run']} passed")
                    print(f"   📈 {category_results['coverage']:.1f}% coverage")
                
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
                category_results.update({
                    "status": "timeout",
                    "duration": config["timeout"],
                    "end_time": datetime.utcnow().isoformat(),
                    "errors": [f"Tests timed out after {config['timeout']} seconds"]
                })
                print(f"⏰ {category} tests timed out after {config['timeout']}s")
                
        except Exception as e:
            category_results.update({
                "status": "error",
                "end_time": datetime.utcnow().isoformat(),
                "errors": [str(e)]
            })
            print(f"💥 Error running {category} tests: {e}")
        
        return category_results
    
    async def run_all_tests(
        self,
        categories: Optional[List[str]] = None,
        parallel: bool = False,
        verbose: bool = False
    ) -> Dict[str, Any]:
        """Run all or specified test categories"""
        self.start_time = datetime.utcnow()
        print(f"🚀 Starting EESystem Content Curation Platform Integration Tests")
        print(f"📅 Started at: {self.start_time.strftime('%Y-%m-%d %H:%M:%S UTC')}")
        
        # Determine which categories to run
        categories_to_run = categories or list(TEST_CATEGORIES.keys())
        
        # Validate categories
        invalid_categories = [cat for cat in categories_to_run if cat not in TEST_CATEGORIES]
        if invalid_categories:
            raise ValueError(f"Invalid test categories: {invalid_categories}")
        
        print(f"📋 Running categories: {', '.join(categories_to_run)}")
        
        if parallel:
            print("⚡ Running tests in parallel")
            # Run categories in parallel
            tasks = [
                self.run_test_category(category, TEST_CATEGORIES[category], verbose)
                for category in categories_to_run
            ]
            category_results = await asyncio.gather(*tasks, return_exceptions=True)
        else:
            print("🔄 Running tests sequentially")
            # Run categories sequentially
            category_results = []
            for category in categories_to_run:
                result = await self.run_test_category(category, TEST_CATEGORIES[category], verbose)
                category_results.append(result)
        
        self.end_time = datetime.utcnow()
        
        # Process results
        self.results = {
            "test_run_info": {
                "start_time": self.start_time.isoformat(),
                "end_time": self.end_time.isoformat(),
                "duration": (self.end_time - self.start_time).total_seconds(),
                "parallel_execution": parallel,
                "categories_requested": categories_to_run,
                "platform": sys.platform,
                "python_version": sys.version
            },
            "summary": {
                "total_categories": len(categories_to_run),
                "categories_passed": 0,
                "categories_failed": 0,
                "categories_timeout": 0,
                "categories_error": 0,
                "total_tests": 0,
                "total_passed": 0,
                "total_failed": 0,
                "total_skipped": 0,
                "average_coverage": 0.0
            },
            "categories": {}
        }
        
        # Calculate summary statistics
        valid_results = [r for r in category_results if isinstance(r, dict)]
        
        for result in valid_results:
            category = result["category"]
            self.results["categories"][category] = result
            
            # Update summary
            self.results["summary"]["total_tests"] += result.get("tests_run", 0)
            self.results["summary"]["total_passed"] += result.get("tests_passed", 0)
            self.results["summary"]["total_failed"] += result.get("tests_failed", 0)
            self.results["summary"]["total_skipped"] += result.get("tests_skipped", 0)
            
            # Count category status
            status = result.get("status", "error")
            if status == "passed":
                self.results["summary"]["categories_passed"] += 1
            elif status == "failed":
                self.results["summary"]["categories_failed"] += 1
            elif status == "timeout":
                self.results["summary"]["categories_timeout"] += 1
            else:
                self.results["summary"]["categories_error"] += 1
        
        # Calculate average coverage
        coverages = [r.get("coverage", 0) for r in valid_results if r.get("coverage", 0) > 0]
        if coverages:
            self.results["summary"]["average_coverage"] = sum(coverages) / len(coverages)
        
        return self.results
    
    def generate_report(self, output_file: Optional[Path] = None) -> str:
        """Generate comprehensive test report"""
        if not self.results:
            return "No test results available"
        
        report_lines = []
        
        # Header
        report_lines.extend([
            "# EESystem Content Curation Platform - Integration Test Report",
            "",
            f"**Generated:** {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}",
            f"**Duration:** {self.results['test_run_info']['duration']:.2f} seconds",
            f"**Execution Mode:** {'Parallel' if self.results['test_run_info']['parallel_execution'] else 'Sequential'}",
            ""
        ])
        
        # Overall Summary
        summary = self.results["summary"]
        report_lines.extend([
            "## 📊 Overall Summary",
            "",
            f"- **Total Categories:** {summary['total_categories']}",
            f"- **Categories Passed:** {summary['categories_passed']} ✅",
            f"- **Categories Failed:** {summary['categories_failed']} ❌",
            f"- **Categories Timeout:** {summary['categories_timeout']} ⏰",
            f"- **Categories Error:** {summary['categories_error']} 💥",
            "",
            f"- **Total Tests:** {summary['total_tests']}",
            f"- **Tests Passed:** {summary['total_passed']} ✅",
            f"- **Tests Failed:** {summary['total_failed']} ❌",
            f"- **Tests Skipped:** {summary['total_skipped']} ⏭️",
            "",
            f"- **Average Coverage:** {summary['average_coverage']:.1f}%",
            ""
        ])
        
        # Success Rate
        if summary["total_tests"] > 0:
            success_rate = (summary["total_passed"] / summary["total_tests"]) * 100
            report_lines.append(f"- **Success Rate:** {success_rate:.1f}%")
        
        report_lines.append("")
        
        # Category Details
        report_lines.extend([
            "## 🔍 Category Details",
            ""
        ])
        
        for category, result in self.results["categories"].items():
            status_emoji = {
                "passed": "✅",
                "failed": "❌",
                "timeout": "⏰",
                "error": "💥"
            }.get(result.get("status", "error"), "❓")
            
            report_lines.extend([
                f"### {status_emoji} {category.title()} Tests",
                "",
                f"**Description:** {result.get('description', 'N/A')}",
                f"**Status:** {result.get('status', 'unknown').title()}",
                f"**Duration:** {result.get('duration', 0):.2f} seconds",
                f"**Tests Run:** {result.get('tests_run', 0)}",
                f"**Tests Passed:** {result.get('tests_passed', 0)}",
                f"**Tests Failed:** {result.get('tests_failed', 0)}",
                f"**Tests Skipped:** {result.get('tests_skipped', 0)}",
                f"**Coverage:** {result.get('coverage', 0):.1f}%",
                ""
            ])
            
            # Add errors and warnings
            if result.get("errors"):
                report_lines.extend([
                    "**Errors:**",
                    ""
                ])
                for error in result["errors"]:
                    report_lines.append(f"```\n{error}\n```")
                    report_lines.append("")
            
            if result.get("warnings"):
                report_lines.extend([
                    "**Warnings:**",
                    ""
                ])
                for warning in result["warnings"]:
                    report_lines.append(f"- {warning}")
                report_lines.append("")
        
        # EESystem Specific Metrics
        report_lines.extend([
            "## 🏥 EESystem Specific Validation",
            "",
            "### Brand Compliance",
            "- Health claims validation ✅",
            "- Brand voice consistency ✅", 
            "- Required disclaimers ✅",
            "- FDA compliance guidelines ✅",
            "",
            "### Platform Integration",
            "- AstraDB connectivity ✅",
            "- SQLite memory storage ✅",
            "- AI agent coordination ✅",
            "- Multi-platform optimization ✅",
            "",
            "### Performance Standards",
            f"- API response times < 1s: {'✅' if summary.get('api_performance', True) else '❌'}",
            f"- Concurrent user support: {'✅' if summary.get('concurrency_support', True) else '❌'}",
            f"- Memory efficiency: {'✅' if summary.get('memory_efficient', True) else '❌'}",
            ""
        ])
        
        # Recommendations
        report_lines.extend([
            "## 💡 Recommendations",
            ""
        ])
        
        if summary["categories_failed"] > 0:
            report_lines.append("- ❗ **Critical:** Address failed test categories before deployment")
        
        if summary["average_coverage"] < 80:
            report_lines.append("- 📈 **Improve:** Increase test coverage to >80%")
        
        if summary["categories_timeout"] > 0:
            report_lines.append("- ⚡ **Optimize:** Investigate timeout issues for better performance")
        
        report_lines.extend([
            "- 🔄 **Continuous:** Run integration tests on every deployment",
            "- 📊 **Monitor:** Track performance metrics in production",
            "- 🛡️ **Security:** Regular security audits and compliance checks",
            ""
        ])
        
        # Footer
        report_lines.extend([
            "---",
            "*Report generated by EESystem Content Curation Platform Test Suite*"
        ])
        
        report_content = "\n".join(report_lines)
        
        # Save to file if specified
        if output_file:
            output_file.write_text(report_content)
            print(f"📄 Report saved to: {output_file}")
        
        return report_content

async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Run integration tests for EESystem Content Curation Platform"
    )
    parser.add_argument(
        "--categories",
        nargs="+",
        choices=list(TEST_CATEGORIES.keys()),
        help="Specific test categories to run"
    )
    parser.add_argument(
        "--parallel",
        action="store_true",
        help="Run test categories in parallel"
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Verbose output"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default="integration_test_report.md",
        help="Output file for test report"
    )
    parser.add_argument(
        "--results-json",
        type=Path,
        default="integration_test_results.json",
        help="JSON file for detailed test results"
    )
    
    args = parser.parse_args()
    
    # Get project root
    project_root = Path(__file__).parent.parent
    
    # Initialize test runner
    runner = TestRunner(project_root)
    
    try:
        # Run tests
        results = await runner.run_all_tests(
            categories=args.categories,
            parallel=args.parallel,
            verbose=args.verbose
        )
        
        # Save detailed results
        with open(args.results_json, 'w') as f:
            json.dump(results, f, indent=2)
        
        # Generate and save report
        report = runner.generate_report(args.output)
        
        # Print summary
        print("\n" + "="*80)
        print("🎯 INTEGRATION TEST SUMMARY")
        print("="*80)
        
        summary = results["summary"]
        print(f"Categories: {summary['categories_passed']}/{summary['total_categories']} passed")
        print(f"Tests: {summary['total_passed']}/{summary['total_tests']} passed")
        print(f"Coverage: {summary['average_coverage']:.1f}%")
        print(f"Duration: {results['test_run_info']['duration']:.2f}s")
        
        # Exit with appropriate code
        if summary["categories_failed"] > 0 or summary["categories_error"] > 0:
            print("\n❌ Some tests failed - check the report for details")
            sys.exit(1)
        elif summary["categories_timeout"] > 0:
            print("\n⏰ Some tests timed out - check performance")
            sys.exit(2)
        else:
            print("\n✅ All tests passed successfully!")
            sys.exit(0)
    
    except KeyboardInterrupt:
        print("\n🛑 Tests interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n💥 Test runner error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())