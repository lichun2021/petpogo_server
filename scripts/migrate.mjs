import mysql from 'mysql2/promise'
import crypto from 'node:crypto'
import {readdir,readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
try { process.loadEnvFile?.() } catch(e) { if(e.code!=='ENOENT')throw e }
const check=process.argv.includes('--check')
let db,locked=false
try{
  db=await mysql.createConnection({socketPath:process.env.MYSQL_SOCKET||undefined,host:process.env.MYSQL_HOST||'127.0.0.1',port:Number(process.env.MYSQL_PORT||3306),user:process.env.MYSQL_USER||'root',password:process.env.MYSQL_PASS||'',database:process.env.MYSQL_DB||'petpogo',supportBigNumbers:true,bigNumberStrings:true})
  await db.query("SET time_zone='+08:00'")
  if(!check){
    const [[lock]]=await db.query("SELECT GET_LOCK(CONCAT('petpogo_migrate_',LEFT(SHA2(DATABASE(),256),32)),10) AS acquired")
    if(Number(lock.acquired)!==1)throw new Error('迁移锁获取失败')
    locked=true
    await db.query('CREATE TABLE IF NOT EXISTS t_schema_migration(version VARCHAR(100) PRIMARY KEY,checksum CHAR(64) NOT NULL,completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB')
  }
  const root=new URL('../migrations/',import.meta.url)
  for(const name of (await readdir(root)).filter(n=>/^\d+.*\.mjs$/.test(n)).sort()){
    const url=new URL(name,root),checksum=crypto.createHash('sha256').update(await readFile(url)).digest('hex')
    const [[record]]=await db.query('SELECT checksum FROM t_schema_migration WHERE version=?',[name])
    if(record){if(record.checksum!==checksum)throw new Error(`已执行迁移被修改: ${name}`);continue}
    if(check)throw new Error(`数据库尚未升级: ${name}`)
    await (await import(fileURLToPath(url))).up(db)
    await db.query('INSERT INTO t_schema_migration(version,checksum) VALUES(?,?)',[name,checksum])
    console.log(`已完成迁移 ${name}`)
  }
  console.log(check?'数据库版本检查通过':'数据库迁移完成')
}catch(e){console.error('数据库升级/检查失败:',e.code||e.message);process.exitCode=1}
finally{if(db){if(locked)await db.query("SELECT RELEASE_LOCK(CONCAT('petpogo_migrate_',LEFT(SHA2(DATABASE(),256),32)))");await db.end()}}
