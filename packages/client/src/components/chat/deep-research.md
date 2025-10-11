# Promptliano Deep Research

## Overview

The goal of the **Promptliano Deep Research** system is to automate the process of:

- Gathering research data from multiple sources.
- Processing and structuring that data into a long-form, context-rich document.
- Building a well-organized final document with references, sections, and a table of contents.
- Exporting the result in multiple formats (e.g., Markdown, PDF).

---

## Process Breakdown

### 1. Research Agent

- **Deep Research Start**
  - Initiates a new deep research record.

- **Gather Sources / URLs**
  - Perform web searches and retrieve relevant sources.
  - Store these sources in a database for reference.

- **Gather Raw Data from Each Source**
  - Pull all available content and metadata.
  - Post-process and compress the data.
  - Save processed data and associate it with the research record.

---

### 2. Document Builder Agent

To **preserve context**, a dedicated **Document Builder Agent** is used to construct the final output.

- **Build Document Outline**
  - Divide the document into sections and sub-sections.
  - Define high-level goals for each section.

- **Section Builder Agent**
  - Query research data to find relevant content per section.
  - Compile full section drafts based on research findings.
  - Mark sources as “cited” when referenced.

- **Aggregate Sections**
  - Combine all completed sections into a full document.
  - Build a table of contents.
  - Order and structure sections according to the ToC.

- **Save & Export**
  - Export the final document in formats like `.md`, `.pdf`, etc.

---

## Mermaid Flowchart

```mermaid
flowchart TD

  %% === Research Phase ===
  subgraph research_phase[Research Phase]
    start[Deep Research Start]
    record[Add Research Record to DB]
    gather_sources[Gather Sources / URLs]
    collect_sources[Search Web & Collect Sources]
    persist_sources[Persist Sources in DB]
    gather_data[Gather Raw Data per Source]
    process_data[Post-process & Compress Data]
    store_data[Store Processed Data Linked to Record]

    start --> record --> gather_sources --> collect_sources --> persist_sources --> gather_data --> process_data --> store_data
  end

  %% === Document Builder Phase ===
  subgraph document_builder_phase[Document Builder Phase]
    kickoff[Kick off Document Builder Agent]
    outline[Build Document Outline & Goals]
    section_agent[Invoke Section Builder Agent]
    query_db[Query Research DB for Section Evidence]
    draft_section[Draft Section with Citations]
    aggregate_sections[Aggregate Completed Sections]
    toc[Generate Table of Contents]
    order_sections[Order Sections per TOC]
    export_doc[Export Final Document (MD / PDF / ...)]

    kickoff --> outline --> section_agent --> query_db --> draft_section --> aggregate_sections --> toc --> order_sections --> export_doc
  end

  store_data --> kickoff
```
