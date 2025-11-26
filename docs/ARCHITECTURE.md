## Architecture (Mermaid)

```mermaid
flowchart TD
    subgraph Teacher_UI[Teacher UI]
        TE[Experiment Authoring\nStory Gen/TTS\nLaunch]
    end

    subgraph Backend[Express API + MongoDB]
        EX[Experiments]
        ST[Stories\n(paragraphs + occurrences)]
        CO[Conditions\n(with/without hints)]
        AS[Assignments]
        AT[Attempts]
        EV[Events / Effort]
        AU[Audio Files\n(static/audio/{expId})]
    end

    subgraph Student_UI[Student UI]
        SJ[Join Screen]
        STU[Student Test\nBlanks + Audio + Hints]
    end

    TE -->|Create/Generate| EX
    EX -->|Generate stories| ST
    EX -->|Launch assigns| CO
    EX -->|Assign student| AS
    ST --> AU

    SJ -->|Join by code\n/api/student/join| EX
    SJ -->|Receives stories\noccurrences + TTS + cues| STU
    STU -->|/api/student/test-attempt\nisCorrect + per-letter| AT
    STU -->|/api/student/test-hint\nnon-revealing hint| EV
    STU -->|Progress Story1->Story2\nAudio cues pause/resume| AU

    AS --> STU
    CO --> STU
```
