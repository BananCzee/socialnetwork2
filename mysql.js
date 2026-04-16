import mysql from "mysql";

const connection = mysql.createConnection({
  host: 'mysqlstudenti.litv.sssvt.cz',
  user: 'lankafilip',
  password: '123456',
  database: '4a2_lankafilip_db2'
});

connection.connect();

export function sqlQuery(query, params, callback) {
  if (typeof params === 'function') {
    callback = params;
    params = [];
  }
  connection.query(query, params, (err, rows) => {
    if (err) { callback(err, null); return; }
    callback(null, rows);
  });
}
