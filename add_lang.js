const sql = require('mssql/msnodesqlv8');

const sqlConfig = {
    connectionString: 'Driver={SQL Server};Server=.\\SQLEXPRESS;Database=HotflixDB;Trusted_Connection=yes;'
};

async function addLangColumn() {
    try {
        let pool = await sql.connect(sqlConfig);
        // Thêm cột 'lang' vào bảng Movies
        await pool.request().query("ALTER TABLE Movies ADD lang NVARCHAR(255)");
        console.log("✅ Đã thêm cột 'lang' (Âm thanh) vào Database thành công!");
    } catch (e) {
        console.log("⚠️ Cột đã tồn tại hoặc có lỗi:", e.message);
    }
    process.exit(0);
}
addLangColumn();