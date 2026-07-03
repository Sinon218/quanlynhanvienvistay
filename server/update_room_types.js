// ===================================================================
// UPDATE ROOM TYPES SCRIPT - server/update_room_types.js
// ===================================================================
const { getPool, sql } = require('./db');

const roomTypeByCode = {
  // 1 ngủ (35 căn)
  'R6A-0505': '1 ngủ', 'R6A-2806': '1 ngủ', 'S1-0405': '1 ngủ', 'S1-0505': '1 ngủ', 'S1-0905': '1 ngủ',
  'S1-1105': '1 ngủ', 'S1-1605': '1 ngủ', 'S1-1705': '1 ngủ', 'S1-1905': '1 ngủ', 'S1-2105': '1 ngủ',
  'S1-2305': '1 ngủ', 'S1-2405': '1 ngủ', 'S1-2505': '1 ngủ', 'S1-2705': '1 ngủ', 'S1-3105': '1 ngủ',
  'S2-0610': '1 ngủ', 'S2-1110': '1 ngủ', 'S2-1111': '1 ngủ', 'S2-1512': '1 ngủ', 'S2-1712': '1 ngủ',
  'S2-2512': '1 ngủ', 'S2-2810': '1 ngủ', 'S2-3210': '1 ngủ', 'S2-3810': '1 ngủ', 'S2-3812': '1 ngủ',
  'S3-0511': '1 ngủ', 'S3-1012': '1 ngủ', 'S3-15A12': '1 ngủ', 'S3-1811': '1 ngủ', 'S3-2012': '1 ngủ',
  'S3-2412': '1 ngủ', 'S3-2712': '1 ngủ', 'S3-2911': '1 ngủ', 'S3-3411': '1 ngủ', 'S3-3512': '1 ngủ',

  // 2 ngủ (40 căn)
  'R4-2519': '2 ngủ', 'R5-2423': '2 ngủ', 'S1-2405A': '2 ngủ', 'S1-2505A': '2 ngủ', 'S1-2809': '2 ngủ',
  'S2-0401': '2 ngủ', 'S2-0501': '2 ngủ', 'S2-0715': '2 ngủ', 'S2-0908': '2 ngủ', 'S2-11A11': '2 ngủ',
  'S2-1511A': '2 ngủ', 'S2-1808': '2 ngủ', 'S2-1901': '2 ngủ', 'S2-2117': '2 ngủ', 'S2-2211A': '2 ngủ',
  'S2-2411': '2 ngủ', 'S2-2811A': '2 ngủ', 'S2-2916': '2 ngủ', 'S2-3301': '2 ngủ', 'S2-3316': '2 ngủ',
  'S2-3411A': '2 ngủ', 'S2-3501': '2 ngủ', 'S2-3517': '2 ngủ', 'S2-3608': '2 ngủ', 'S2-3708': '2 ngủ',
  'S2-3811A': '2 ngủ', 'S2-3816': '2 ngủ', 'S2-3908': '2 ngủ', 'S3-0715': '2 ngủ', 'S3-0810': '2 ngủ',
  'S3-0908': '2 ngủ', 'S3-1001': '2 ngủ', 'S3-15A08A': '2 ngủ', 'S3-1616': '2 ngủ', 'S3-1701': '2 ngủ',
  'S3-1901': '2 ngủ', 'S3-2301': '2 ngủ', 'S3-3001': '2 ngủ', 'S3-3015': '2 ngủ', 'S3-3316': '2 ngủ',

  // 3 ngủ (8 căn)
  'B-2102': '3 ngủ', 'S1-0508': '3 ngủ', 'S2-1220': '3 ngủ', 'S3-2406': '3 ngủ', 'S3-2909': '3 ngủ',
  'S2-3420': '3 ngủ', 'S3-3702': '3 ngủ', 'S3-3906': '3 ngủ',

  // 4 ngủ (2 căn)
  'S2-2106': '4 ngủ', 'S3-3918': '4 ngủ'
};

async function run() {
  let pool;
  try {
    pool = await getPool();
    console.log('Updating room types in database...');
    for (const [code, type] of Object.entries(roomTypeByCode)) {
      await pool.request()
        .input('code', sql.VarChar, code)
        .input('type', sql.NVarChar, type)
        .query('UPDATE Apartments SET room_type = @type WHERE code = @code');
    }
    console.log('Room types update completed successfully!');
  } catch (err) {
    console.error('Update room types failed:', err.message);
  } finally {
    if (pool) {
      await pool.close();
    }
    process.exit(0);
  }
}
run();
