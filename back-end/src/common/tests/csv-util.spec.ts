import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CSV_BOM, CsvParseError, csvCell, parseCsv, unguardCsvText } from '../utils/csv.util';

describe('parseCsv (RFC 4180)', () => {
  it('ô thường, ô bọc nháy, nháy kép đôi, dấu phẩy trong ô', () => {
    assert.deepEqual(parseCsv('a,"b,c","say ""hi"""\n'), [['a', 'b,c', 'say "hi"']]);
  });

  it('xuống dòng bên trong ô có nháy (LF và CRLF) được giữ nguyên', () => {
    assert.deepEqual(parseCsv('"dòng 1\ndòng 2","x\r\ny"\r\nb,c'), [['dòng 1\ndòng 2', 'x\r\ny'], ['b', 'c']]);
  });

  it('ngắt dòng CRLF, LF và CR đơn', () => {
    assert.deepEqual(parseCsv('a,b\r\nc,d\ne,f\rg,h'), [['a', 'b'], ['c', 'd'], ['e', 'f'], ['g', 'h']]);
  });

  it('bỏ BOM đầu file và dòng trống hoàn toàn', () => {
    assert.deepEqual(parseCsv(`${CSV_BOM}a,b\n\n\nc,d\n\n`), [['a', 'b'], ['c', 'd']]);
  });

  it('ô trống ở cuối dòng và ô rỗng có nháy được giữ', () => {
    assert.deepEqual(parseCsv('a,\n"",b\n,,'), [['a', ''], ['', 'b'], ['', '', '']]);
  });

  it('không có dòng cuối kết thúc bằng xuống dòng', () => {
    assert.deepEqual(parseCsv('a,b'), [['a', 'b']]);
  });

  it('chuỗi rỗng → không có dòng', () => {
    assert.deepEqual(parseCsv(''), []);
  });

  it('Unicode tiếng Việt, emoji, chữ CJK', () => {
    assert.deepEqual(parseCsv('"Bình gốm 🏺","陶瓷","도자기"'), [['Bình gốm 🏺', '陶瓷', '도자기']]);
  });

  it('nháy kép không đóng → CsvParseError kèm số dòng mở nháy', () => {
    assert.throws(() => parseCsv('a,b\nc,"chưa đóng\nvẫn chưa'), (error: unknown) =>
      error instanceof CsvParseError && error.line === 2 && /không đóng/.test(error.message));
  });

  it('ký tự sau nháy đóng → CsvParseError', () => {
    assert.throws(() => parseCsv('"abc"x,d'), (error: unknown) => error instanceof CsvParseError && /sau dấu nháy/.test(error.message));
  });

  it('nháy giữa ô không bọc nháy được coi là ký tự thường', () => {
    assert.deepEqual(parseCsv('5" màn hình,b'), [['5" màn hình', 'b']]);
  });
});

describe('csvCell / unguardCsvText', () => {
  it('luôn bọc nháy, nhân đôi nháy, null → ""', () => {
    assert.equal(csvCell('a"b'), '"a""b"');
    assert.equal(csvCell(null), '""');
  });

  for (const formula of ['=SUM(A1)', '+1', '-2', '@cmd', '\tx', '\rx']) {
    it(`chống CSV injection: ${JSON.stringify(formula)} được thêm ' và bỏ lại được khi nhập`, () => {
      const cell = csvCell(formula);
      assert.equal(cell, `"'${formula}"`);
      assert.equal(unguardCsvText(parseCsv(cell)[0][0]), formula);
    });
  }

  it('cột số tắt guard: -4.5 giữ nguyên', () => {
    assert.equal(csvCell('-4.5', { guardFormula: false }), '"-4.5"');
  });

  for (const text of ["'Ngọc' của vua", "'-abc", "''", "'", 'bình thường', "a'b"]) {
    it(`xuất rồi nhập lại giữ nguyên giá trị: ${JSON.stringify(text)}`, () => {
      assert.equal(unguardCsvText(parseCsv(csvCell(text))[0][0]), text);
    });
  }

  it("file người dùng tự gõ (không qua csvCell): 'Ngọc' giữ nguyên", () => {
    assert.equal(unguardCsvText("'Ngọc' của vua"), "'Ngọc' của vua");
  });
});
