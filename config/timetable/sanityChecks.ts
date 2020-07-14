/**
 * Every SQL below should return empty list of results.
 * If there are any results data update should fail
 */
const timetableSanityChecks = [
        `SELECT s.train_uid, GROUP_CONCAT(se.atoc_code)
         FROM schedule s
                  JOIN schedule_extra se ON s.id = se.schedule
         WHERE s.train_uid = "W55352"
           AND CURRENT_DATE() BETWEEN s.runs_from AND s.runs_to
         GROUP BY s.train_uid
         HAVING COUNT(DISTINCT se.atoc_code) > 1;`
];

export default timetableSanityChecks;
