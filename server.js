const express = require('express');
const sql = require('mssql');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

const sqlConfig = {
    user: 'Longgia2210_SQLLogin_1', 
    password: 'fpsl9mhxmc', 
    server: 'hotflix_db.mssql.somee.com', 
    database: 'hotflix_db', 
    options: {
        encrypt: true, 
        trustServerCertificate: true 
    }
};
app.get('/api/movies', async (req, res) => {
    try {
        let page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 24;
        let offset = (page - 1) * limit;

        // 1. Nhận các từ khóa lọc từ frontend gửi lên
        let { genre, country, type, year, search, audio } = req.query;

        // Từ điển ánh xạ từ slug sang tên tiếng Việt trong Database
        const countryMap = {
            'trung-quoc': 'Trung Quốc',
            'han-quoc': 'Hàn Quốc',
            'thai-lan': 'Thái Lan',
            'nhat-ban': 'Nhật Bản',
            'dai-loan': 'Đài Loan',
            'hong-kong': 'Hồng Kông',
            'au-my': 'Âu Mỹ',
            'viet-nam': 'Việt Nam',
            'an-do': 'Ấn Độ',
            'phap': 'Pháp'
        };
// ... (code từ điển countryMap cũ vẫn giữ nguyên)
        if (country && countryMap[country]) {
            country = countryMap[country];
        }

        // BỔ SUNG: Từ điển ánh xạ cho Loại phim
        // BỔ SUNG: Từ điển ánh xạ cho Âm thanh
        const audioMap = {
            'vietsub': 'Vietsub',
            'thuyet-minh': 'Thuyết minh',
            'long-tieng': 'Lồng tiếng'
        };

        if (audio && audioMap[audio]) {
            audio = audioMap[audio];
        }
        const typeMap = {
            'phim-bo': 'series',
            'phim-le': 'single',
            'hoat-hinh': 'hoathinh',
            'tv-shows': 'tvshows'
        };

        // Nếu client gửi slug, tự đổi sang mã tiếng Anh để khớp Database
        if (type && typeMap[type]) {
            type = typeMap[type];
        }

        let pool = await sql.connect(sqlConfig);
        let request = pool.request();

        // 2. Xây dựng bộ lọc SQL tự động (có điều kiện nào thì lắp điều kiện đó)
        let conditions = [];

        if (genre) {
            conditions.push("genre LIKE '%' + @genre + '%'");
            request.input('genre', sql.NVarChar, genre);
        }
        if (country) {
            conditions.push("country LIKE '%' + @country + '%'"); // Dùng LIKE để khớp dữ liệu tiếng Việt
            request.input('country', sql.NVarChar, country);
        }
        if (type) {
            conditions.push("type = @type");
            request.input('type', sql.VarChar, type);
        }
        if (year) {
            conditions.push("year = @year");
            request.input('year', sql.Int, parseInt(year));
        }
        if (search) {
            conditions.push("(name LIKE '%' + @search + '%' OR origin_name LIKE '%' + @search + '%')");
            request.input('search', sql.NVarChar, search);
        }
        if (audio) {
            conditions.push("lang LIKE '%' + @audio + '%'");
            request.input('audio', sql.NVarChar, audio);
        }
        // Ghép các điều kiện lại bằng chữ AND (nếu có)
        let whereSQL = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

        // 3. Đếm tổng số phim thỏa mãn điều kiện để Frontend làm phân trang
        let countResult = await request.query(`SELECT COUNT(*) as total FROM Movies ${whereSQL}`);
        let totalMovies = countResult.recordset[0].total;

        // 4. Lấy dữ liệu phim chính thức
        request.input('offset', sql.Int, offset);
        request.input('limit', sql.Int, limit);
        
        let result = await request.query(`
            SELECT * FROM Movies 
            ${whereSQL}
            ORDER BY id DESC 
            OFFSET @offset ROWS 
            FETCH NEXT @limit ROWS ONLY
        `);
        
        res.json({
            status: true,
            total: totalMovies,
            items: result.recordset,
            page: page,
            totalPages: Math.ceil(totalMovies / limit)
        });

    } catch (error) {
        console.log("❌ Lỗi API:", error);
        res.status(500).json({ status: false, message: "Lỗi máy chủ" });
    }
});

app.listen(port, () => {
    console.log(`🚀 Trạm API [BẢN NÂNG CẤP BỘ LỌC] đang chạy tại cổng ${port}`);
});