## MODIFIED Requirements

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
