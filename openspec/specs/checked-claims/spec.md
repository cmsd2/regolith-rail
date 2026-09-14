# checked-claims Specification

## Purpose
Ties the mathematical results and simulator claims stated in the documentation to checks run by a computer
algebra system, Python or the simulator, so that a wrong formula or number fails the build.

## Requirements

### Requirement: Checks
A check SHALL be one of:

- **Maxima:** a named cell in a Maxima notebook stored beside the page it supports.
- **Python:** a script stored beside the page, declaring its dependencies with pinned versions.
- **Simulator:** a runnable example with stated output, or a named unit test against a scenario.

A Maxima or Python check SHALL fail by raising an error when a result differs from the value it verifies.
Printing a value alone SHALL NOT count as a check.

#### Scenario: Maxima check fails on a wrong value
- **WHEN** a Maxima check asserts that the critical ratio for a price of 5 and a cost of 3 is 2/5, and the
  page's formula is changed so that the notebook computes 3/5
- **THEN** running the checks fails and names the page, the notebook and the cell

### Requirement: Claims refer to checks
In Book pages, every displayed formula, every numeric result stated in the text and every exercise answer
SHALL carry a reference to the check that verifies it. A displayed formula's check SHALL appear after the
formula and before the next heading or displayed formula, so that one check placed after a formula's worked
numbers verifies both. Outside exercise answers, a page SHALL cite a given check at most once. The
documentation checks SHALL fail when:

- a Book page displays mathematics with no check reference before the next heading or displayed formula;
- a Book page cites the same check twice outside exercise answers;
- a reference names a check that does not exist;
- any referenced check fails.

#### Scenario: Unchecked formula
- **WHEN** a displayed equation is added to chapter 4 with no check reference before the next heading
- **THEN** the documentation checks fail and name the chapter and the equation's line

#### Scenario: Check after the worked numbers
- **WHEN** a formula is followed by a paragraph stating its value for the worked case and then one check
- **THEN** the documentation checks pass

#### Scenario: Repeated citation
- **WHEN** a chapter cites the same Maxima cell after a formula and again after the paragraph that follows
- **THEN** the documentation checks fail and name the chapter and the repeated check

#### Scenario: Missing check
- **WHEN** a page refers to a notebook cell that has been renamed
- **THEN** the documentation checks fail and name the page and the missing cell

### Requirement: Showing the working
A reader SHALL be able to open the checking code for any checked claim from beside the claim, without
leaving the page.

#### Scenario: Open a check
- **WHEN** a reader opens the check beside the economic order quantity formula in chapter 5
- **THEN** the Maxima input that derives and verifies it is shown under the formula

### Requirement: Running the checks
One command SHALL run every Maxima, Python and simulator check for the documentation and report each failure
with its page and check. It SHALL fail, saying what is missing, when Maxima or the notebook runner is not
installed. The checks SHALL run in continuous integration as a job that blocks merging and deploying.

#### Scenario: Tools missing locally
- **WHEN** a contributor runs the documentation checks without Maxima installed
- **THEN** the command exits with an error that names Maxima and how to install it

#### Scenario: CI blocks on a failing check
- **WHEN** a pull request changes a chapter so that one of its checks fails
- **THEN** the documentation checks job fails and the site is not deployed

### Requirement: Reproducible tools
Continuous integration SHALL use pinned versions of the notebook runner and the Python dependencies, and
SHALL verify the downloaded notebook runner against a recorded checksum.

#### Scenario: Tampered download
- **WHEN** the notebook runner downloaded in CI does not match its recorded checksum
- **THEN** the job fails before running any check
