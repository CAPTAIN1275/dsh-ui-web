window.__ModuleLoader__.load({
	id: "@captain1275/dsh-usage-dashboard",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_dom_client = require("react-dom/client");
		let react = require("react");
		let react_dom = require("react-dom");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region ../../node_modules/.pnpm/qrcode-generator@2.0.4/node_modules/qrcode-generator/dist/qrcode.mjs
		/**
		* qrcode
		* @param typeNumber 1 to 40
		* @param errorCorrectionLevel 'L','M','Q','H'
		*/
		const qrcode = function(typeNumber, errorCorrectionLevel) {
			const PAD0 = 236;
			const PAD1 = 17;
			let _typeNumber = typeNumber;
			const _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
			let _modules = null;
			let _moduleCount = 0;
			let _dataCache = null;
			const _dataList = [];
			const _this = {};
			const makeImpl = function(test, maskPattern) {
				_moduleCount = _typeNumber * 4 + 17;
				_modules = function(moduleCount) {
					const modules = new Array(moduleCount);
					for (let row = 0; row < moduleCount; row += 1) {
						modules[row] = new Array(moduleCount);
						for (let col = 0; col < moduleCount; col += 1) modules[row][col] = null;
					}
					return modules;
				}(_moduleCount);
				setupPositionProbePattern(0, 0);
				setupPositionProbePattern(_moduleCount - 7, 0);
				setupPositionProbePattern(0, _moduleCount - 7);
				setupPositionAdjustPattern();
				setupTimingPattern();
				setupTypeInfo(test, maskPattern);
				if (_typeNumber >= 7) setupTypeNumber(test);
				if (_dataCache == null) _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
				mapData(_dataCache, maskPattern);
			};
			const setupPositionProbePattern = function(row, col) {
				for (let r = -1; r <= 7; r += 1) {
					if (row + r <= -1 || _moduleCount <= row + r) continue;
					for (let c = -1; c <= 7; c += 1) {
						if (col + c <= -1 || _moduleCount <= col + c) continue;
						if (0 <= r && r <= 6 && (c == 0 || c == 6) || 0 <= c && c <= 6 && (r == 0 || r == 6) || 2 <= r && r <= 4 && 2 <= c && c <= 4) _modules[row + r][col + c] = true;
						else _modules[row + r][col + c] = false;
					}
				}
			};
			const getBestMaskPattern = function() {
				let minLostPoint = 0;
				let pattern = 0;
				for (let i = 0; i < 8; i += 1) {
					makeImpl(true, i);
					const lostPoint = QRUtil.getLostPoint(_this);
					if (i == 0 || minLostPoint > lostPoint) {
						minLostPoint = lostPoint;
						pattern = i;
					}
				}
				return pattern;
			};
			const setupTimingPattern = function() {
				for (let r = 8; r < _moduleCount - 8; r += 1) {
					if (_modules[r][6] != null) continue;
					_modules[r][6] = r % 2 == 0;
				}
				for (let c = 8; c < _moduleCount - 8; c += 1) {
					if (_modules[6][c] != null) continue;
					_modules[6][c] = c % 2 == 0;
				}
			};
			const setupPositionAdjustPattern = function() {
				const pos = QRUtil.getPatternPosition(_typeNumber);
				for (let i = 0; i < pos.length; i += 1) for (let j = 0; j < pos.length; j += 1) {
					const row = pos[i];
					const col = pos[j];
					if (_modules[row][col] != null) continue;
					for (let r = -2; r <= 2; r += 1) for (let c = -2; c <= 2; c += 1) if (r == -2 || r == 2 || c == -2 || c == 2 || r == 0 && c == 0) _modules[row + r][col + c] = true;
					else _modules[row + r][col + c] = false;
				}
			};
			const setupTypeNumber = function(test) {
				const bits = QRUtil.getBCHTypeNumber(_typeNumber);
				for (let i = 0; i < 18; i += 1) {
					const mod = !test && (bits >> i & 1) == 1;
					_modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
				}
				for (let i = 0; i < 18; i += 1) {
					const mod = !test && (bits >> i & 1) == 1;
					_modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
				}
			};
			const setupTypeInfo = function(test, maskPattern) {
				const data = _errorCorrectionLevel << 3 | maskPattern;
				const bits = QRUtil.getBCHTypeInfo(data);
				for (let i = 0; i < 15; i += 1) {
					const mod = !test && (bits >> i & 1) == 1;
					if (i < 6) _modules[i][8] = mod;
					else if (i < 8) _modules[i + 1][8] = mod;
					else _modules[_moduleCount - 15 + i][8] = mod;
				}
				for (let i = 0; i < 15; i += 1) {
					const mod = !test && (bits >> i & 1) == 1;
					if (i < 8) _modules[8][_moduleCount - i - 1] = mod;
					else if (i < 9) _modules[8][15 - i - 1 + 1] = mod;
					else _modules[8][15 - i - 1] = mod;
				}
				_modules[_moduleCount - 8][8] = !test;
			};
			const mapData = function(data, maskPattern) {
				let inc = -1;
				let row = _moduleCount - 1;
				let bitIndex = 7;
				let byteIndex = 0;
				const maskFunc = QRUtil.getMaskFunction(maskPattern);
				for (let col = _moduleCount - 1; col > 0; col -= 2) {
					if (col == 6) col -= 1;
					while (true) {
						for (let c = 0; c < 2; c += 1) if (_modules[row][col - c] == null) {
							let dark = false;
							if (byteIndex < data.length) dark = (data[byteIndex] >>> bitIndex & 1) == 1;
							if (maskFunc(row, col - c)) dark = !dark;
							_modules[row][col - c] = dark;
							bitIndex -= 1;
							if (bitIndex == -1) {
								byteIndex += 1;
								bitIndex = 7;
							}
						}
						row += inc;
						if (row < 0 || _moduleCount <= row) {
							row -= inc;
							inc = -inc;
							break;
						}
					}
				}
			};
			const createBytes = function(buffer, rsBlocks) {
				let offset = 0;
				let maxDcCount = 0;
				let maxEcCount = 0;
				const dcdata = new Array(rsBlocks.length);
				const ecdata = new Array(rsBlocks.length);
				for (let r = 0; r < rsBlocks.length; r += 1) {
					const dcCount = rsBlocks[r].dataCount;
					const ecCount = rsBlocks[r].totalCount - dcCount;
					maxDcCount = Math.max(maxDcCount, dcCount);
					maxEcCount = Math.max(maxEcCount, ecCount);
					dcdata[r] = new Array(dcCount);
					for (let i = 0; i < dcdata[r].length; i += 1) dcdata[r][i] = 255 & buffer.getBuffer()[i + offset];
					offset += dcCount;
					const rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
					const modPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1).mod(rsPoly);
					ecdata[r] = new Array(rsPoly.getLength() - 1);
					for (let i = 0; i < ecdata[r].length; i += 1) {
						const modIndex = i + modPoly.getLength() - ecdata[r].length;
						ecdata[r][i] = modIndex >= 0 ? modPoly.getAt(modIndex) : 0;
					}
				}
				let totalCodeCount = 0;
				for (let i = 0; i < rsBlocks.length; i += 1) totalCodeCount += rsBlocks[i].totalCount;
				const data = new Array(totalCodeCount);
				let index = 0;
				for (let i = 0; i < maxDcCount; i += 1) for (let r = 0; r < rsBlocks.length; r += 1) if (i < dcdata[r].length) {
					data[index] = dcdata[r][i];
					index += 1;
				}
				for (let i = 0; i < maxEcCount; i += 1) for (let r = 0; r < rsBlocks.length; r += 1) if (i < ecdata[r].length) {
					data[index] = ecdata[r][i];
					index += 1;
				}
				return data;
			};
			const createData = function(typeNumber, errorCorrectionLevel, dataList) {
				const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);
				const buffer = qrBitBuffer();
				for (let i = 0; i < dataList.length; i += 1) {
					const data = dataList[i];
					buffer.put(data.getMode(), 4);
					buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber));
					data.write(buffer);
				}
				let totalDataCount = 0;
				for (let i = 0; i < rsBlocks.length; i += 1) totalDataCount += rsBlocks[i].dataCount;
				if (buffer.getLengthInBits() > totalDataCount * 8) throw "code length overflow. (" + buffer.getLengthInBits() + ">" + totalDataCount * 8 + ")";
				if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) buffer.put(0, 4);
				while (buffer.getLengthInBits() % 8 != 0) buffer.putBit(false);
				while (true) {
					if (buffer.getLengthInBits() >= totalDataCount * 8) break;
					buffer.put(PAD0, 8);
					if (buffer.getLengthInBits() >= totalDataCount * 8) break;
					buffer.put(PAD1, 8);
				}
				return createBytes(buffer, rsBlocks);
			};
			_this.addData = function(data, mode) {
				mode = mode || "Byte";
				let newData = null;
				switch (mode) {
					case "Numeric":
						newData = qrNumber(data);
						break;
					case "Alphanumeric":
						newData = qrAlphaNum(data);
						break;
					case "Byte":
						newData = qr8BitByte(data);
						break;
					case "Kanji":
						newData = qrKanji(data);
						break;
					default: throw "mode:" + mode;
				}
				_dataList.push(newData);
				_dataCache = null;
			};
			_this.isDark = function(row, col) {
				if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) throw row + "," + col;
				return _modules[row][col];
			};
			_this.getModuleCount = function() {
				return _moduleCount;
			};
			_this.make = function() {
				if (_typeNumber < 1) {
					let typeNumber = 1;
					for (; typeNumber < 40; typeNumber++) {
						const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel);
						const buffer = qrBitBuffer();
						for (let i = 0; i < _dataList.length; i++) {
							const data = _dataList[i];
							buffer.put(data.getMode(), 4);
							buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber));
							data.write(buffer);
						}
						let totalDataCount = 0;
						for (let i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;
						if (buffer.getLengthInBits() <= totalDataCount * 8) break;
					}
					_typeNumber = typeNumber;
				}
				makeImpl(false, getBestMaskPattern());
			};
			_this.createTableTag = function(cellSize, margin) {
				cellSize = cellSize || 2;
				margin = typeof margin == "undefined" ? cellSize * 4 : margin;
				let qrHtml = "";
				qrHtml += "<table style=\"";
				qrHtml += " border-width: 0px; border-style: none;";
				qrHtml += " border-collapse: collapse;";
				qrHtml += " padding: 0px; margin: " + margin + "px;";
				qrHtml += "\">";
				qrHtml += "<tbody>";
				for (let r = 0; r < _this.getModuleCount(); r += 1) {
					qrHtml += "<tr>";
					for (let c = 0; c < _this.getModuleCount(); c += 1) {
						qrHtml += "<td style=\"";
						qrHtml += " border-width: 0px; border-style: none;";
						qrHtml += " border-collapse: collapse;";
						qrHtml += " padding: 0px; margin: 0px;";
						qrHtml += " width: " + cellSize + "px;";
						qrHtml += " height: " + cellSize + "px;";
						qrHtml += " background-color: ";
						qrHtml += _this.isDark(r, c) ? "#000000" : "#ffffff";
						qrHtml += ";";
						qrHtml += "\"/>";
					}
					qrHtml += "</tr>";
				}
				qrHtml += "</tbody>";
				qrHtml += "</table>";
				return qrHtml;
			};
			_this.createSvgTag = function(cellSize, margin, alt, title) {
				let opts = {};
				if (typeof arguments[0] == "object") {
					opts = arguments[0];
					cellSize = opts.cellSize;
					margin = opts.margin;
					alt = opts.alt;
					title = opts.title;
				}
				cellSize = cellSize || 2;
				margin = typeof margin == "undefined" ? cellSize * 4 : margin;
				alt = typeof alt === "string" ? { text: alt } : alt || {};
				alt.text = alt.text || null;
				alt.id = alt.text ? alt.id || "qrcode-description" : null;
				title = typeof title === "string" ? { text: title } : title || {};
				title.text = title.text || null;
				title.id = title.text ? title.id || "qrcode-title" : null;
				const size = _this.getModuleCount() * cellSize + margin * 2;
				let c, mc, r, mr, qrSvg = "", rect;
				rect = "l" + cellSize + ",0 0," + cellSize + " -" + cellSize + ",0 0,-" + cellSize + "z ";
				qrSvg += "<svg version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\"";
				qrSvg += !opts.scalable ? " width=\"" + size + "px\" height=\"" + size + "px\"" : "";
				qrSvg += " viewBox=\"0 0 " + size + " " + size + "\" ";
				qrSvg += " preserveAspectRatio=\"xMinYMin meet\"";
				qrSvg += title.text || alt.text ? " role=\"img\" aria-labelledby=\"" + escapeXml([title.id, alt.id].join(" ").trim()) + "\"" : "";
				qrSvg += ">";
				qrSvg += title.text ? "<title id=\"" + escapeXml(title.id) + "\">" + escapeXml(title.text) + "</title>" : "";
				qrSvg += alt.text ? "<description id=\"" + escapeXml(alt.id) + "\">" + escapeXml(alt.text) + "</description>" : "";
				qrSvg += "<rect width=\"100%\" height=\"100%\" fill=\"white\" cx=\"0\" cy=\"0\"/>";
				qrSvg += "<path d=\"";
				for (r = 0; r < _this.getModuleCount(); r += 1) {
					mr = r * cellSize + margin;
					for (c = 0; c < _this.getModuleCount(); c += 1) if (_this.isDark(r, c)) {
						mc = c * cellSize + margin;
						qrSvg += "M" + mc + "," + mr + rect;
					}
				}
				qrSvg += "\" stroke=\"transparent\" fill=\"black\"/>";
				qrSvg += "</svg>";
				return qrSvg;
			};
			_this.createDataURL = function(cellSize, margin) {
				cellSize = cellSize || 2;
				margin = typeof margin == "undefined" ? cellSize * 4 : margin;
				const size = _this.getModuleCount() * cellSize + margin * 2;
				const min = margin;
				const max = size - margin;
				return createDataURL(size, size, function(x, y) {
					if (min <= x && x < max && min <= y && y < max) {
						const c = Math.floor((x - min) / cellSize);
						const r = Math.floor((y - min) / cellSize);
						return _this.isDark(r, c) ? 0 : 1;
					} else return 1;
				});
			};
			_this.createImgTag = function(cellSize, margin, alt) {
				cellSize = cellSize || 2;
				margin = typeof margin == "undefined" ? cellSize * 4 : margin;
				const size = _this.getModuleCount() * cellSize + margin * 2;
				let img = "";
				img += "<img";
				img += " src=\"";
				img += _this.createDataURL(cellSize, margin);
				img += "\"";
				img += " width=\"";
				img += size;
				img += "\"";
				img += " height=\"";
				img += size;
				img += "\"";
				if (alt) {
					img += " alt=\"";
					img += escapeXml(alt);
					img += "\"";
				}
				img += "/>";
				return img;
			};
			const escapeXml = function(s) {
				let escaped = "";
				for (let i = 0; i < s.length; i += 1) {
					const c = s.charAt(i);
					switch (c) {
						case "<":
							escaped += "&lt;";
							break;
						case ">":
							escaped += "&gt;";
							break;
						case "&":
							escaped += "&amp;";
							break;
						case "\"":
							escaped += "&quot;";
							break;
						default:
							escaped += c;
							break;
					}
				}
				return escaped;
			};
			const _createHalfASCII = function(margin) {
				const cellSize = 1;
				margin = typeof margin == "undefined" ? cellSize * 2 : margin;
				const size = _this.getModuleCount() * cellSize + margin * 2;
				const min = margin;
				const max = size - margin;
				let y, x, r1, r2, p;
				const blocks = {
					"██": "█",
					"█ ": "▀",
					" █": "▄",
					"  ": " "
				};
				const blocksLastLineNoMargin = {
					"██": "▀",
					"█ ": "▀",
					" █": " ",
					"  ": " "
				};
				let ascii = "";
				for (y = 0; y < size; y += 2) {
					r1 = Math.floor((y - min) / cellSize);
					r2 = Math.floor((y + 1 - min) / cellSize);
					for (x = 0; x < size; x += 1) {
						p = "█";
						if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) p = " ";
						if (min <= x && x < max && min <= y + 1 && y + 1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) p += " ";
						else p += "█";
						ascii += margin < 1 && y + 1 >= max ? blocksLastLineNoMargin[p] : blocks[p];
					}
					ascii += "\n";
				}
				if (size % 2 && margin > 0) return ascii.substring(0, ascii.length - size - 1) + Array(size + 1).join("▀");
				return ascii.substring(0, ascii.length - 1);
			};
			_this.createASCII = function(cellSize, margin) {
				cellSize = cellSize || 1;
				if (cellSize < 2) return _createHalfASCII(margin);
				cellSize -= 1;
				margin = typeof margin == "undefined" ? cellSize * 2 : margin;
				const size = _this.getModuleCount() * cellSize + margin * 2;
				const min = margin;
				const max = size - margin;
				let y, x, r, p;
				const white = Array(cellSize + 1).join("██");
				const black = Array(cellSize + 1).join("  ");
				let ascii = "";
				let line = "";
				for (y = 0; y < size; y += 1) {
					r = Math.floor((y - min) / cellSize);
					line = "";
					for (x = 0; x < size; x += 1) {
						p = 1;
						if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) p = 0;
						line += p ? white : black;
					}
					for (r = 0; r < cellSize; r += 1) ascii += line + "\n";
				}
				return ascii.substring(0, ascii.length - 1);
			};
			_this.renderTo2dContext = function(context, cellSize) {
				cellSize = cellSize || 2;
				const length = _this.getModuleCount();
				for (let row = 0; row < length; row++) for (let col = 0; col < length; col++) {
					context.fillStyle = _this.isDark(row, col) ? "black" : "white";
					context.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
				}
			};
			return _this;
		};
		qrcode.stringToBytes = function(s) {
			const bytes = [];
			for (let i = 0; i < s.length; i += 1) {
				const c = s.charCodeAt(i);
				bytes.push(c & 255);
			}
			return bytes;
		};
		/**
		* @param unicodeData base64 string of byte array.
		* [16bit Unicode],[16bit Bytes], ...
		* @param numChars
		*/
		qrcode.createStringToBytes = function(unicodeData, numChars) {
			const unicodeMap = function() {
				const bin = base64DecodeInputStream(unicodeData);
				const read = function() {
					const b = bin.read();
					if (b == -1) throw "eof";
					return b;
				};
				let count = 0;
				const unicodeMap = {};
				while (true) {
					const b0 = bin.read();
					if (b0 == -1) break;
					const b1 = read();
					const b2 = read();
					const b3 = read();
					const k = String.fromCharCode(b0 << 8 | b1);
					unicodeMap[k] = b2 << 8 | b3;
					count += 1;
				}
				if (count != numChars) throw count + " != " + numChars;
				return unicodeMap;
			}();
			const unknownChar = "?".charCodeAt(0);
			return function(s) {
				const bytes = [];
				for (let i = 0; i < s.length; i += 1) {
					const c = s.charCodeAt(i);
					if (c < 128) bytes.push(c);
					else {
						const b = unicodeMap[s.charAt(i)];
						if (typeof b == "number") if ((b & 255) == b) bytes.push(b);
						else {
							bytes.push(b >>> 8);
							bytes.push(b & 255);
						}
						else bytes.push(unknownChar);
					}
				}
				return bytes;
			};
		};
		const QRMode = {
			MODE_NUMBER: 1,
			MODE_ALPHA_NUM: 2,
			MODE_8BIT_BYTE: 4,
			MODE_KANJI: 8
		};
		const QRErrorCorrectionLevel = {
			L: 1,
			M: 0,
			Q: 3,
			H: 2
		};
		const QRMaskPattern = {
			PATTERN000: 0,
			PATTERN001: 1,
			PATTERN010: 2,
			PATTERN011: 3,
			PATTERN100: 4,
			PATTERN101: 5,
			PATTERN110: 6,
			PATTERN111: 7
		};
		const QRUtil = function() {
			const PATTERN_POSITION_TABLE = [
				[],
				[6, 18],
				[6, 22],
				[6, 26],
				[6, 30],
				[6, 34],
				[
					6,
					22,
					38
				],
				[
					6,
					24,
					42
				],
				[
					6,
					26,
					46
				],
				[
					6,
					28,
					50
				],
				[
					6,
					30,
					54
				],
				[
					6,
					32,
					58
				],
				[
					6,
					34,
					62
				],
				[
					6,
					26,
					46,
					66
				],
				[
					6,
					26,
					48,
					70
				],
				[
					6,
					26,
					50,
					74
				],
				[
					6,
					30,
					54,
					78
				],
				[
					6,
					30,
					56,
					82
				],
				[
					6,
					30,
					58,
					86
				],
				[
					6,
					34,
					62,
					90
				],
				[
					6,
					28,
					50,
					72,
					94
				],
				[
					6,
					26,
					50,
					74,
					98
				],
				[
					6,
					30,
					54,
					78,
					102
				],
				[
					6,
					28,
					54,
					80,
					106
				],
				[
					6,
					32,
					58,
					84,
					110
				],
				[
					6,
					30,
					58,
					86,
					114
				],
				[
					6,
					34,
					62,
					90,
					118
				],
				[
					6,
					26,
					50,
					74,
					98,
					122
				],
				[
					6,
					30,
					54,
					78,
					102,
					126
				],
				[
					6,
					26,
					52,
					78,
					104,
					130
				],
				[
					6,
					30,
					56,
					82,
					108,
					134
				],
				[
					6,
					34,
					60,
					86,
					112,
					138
				],
				[
					6,
					30,
					58,
					86,
					114,
					142
				],
				[
					6,
					34,
					62,
					90,
					118,
					146
				],
				[
					6,
					30,
					54,
					78,
					102,
					126,
					150
				],
				[
					6,
					24,
					50,
					76,
					102,
					128,
					154
				],
				[
					6,
					28,
					54,
					80,
					106,
					132,
					158
				],
				[
					6,
					32,
					58,
					84,
					110,
					136,
					162
				],
				[
					6,
					26,
					54,
					82,
					110,
					138,
					166
				],
				[
					6,
					30,
					58,
					86,
					114,
					142,
					170
				]
			];
			const G15 = 1335;
			const G18 = 7973;
			const G15_MASK = 21522;
			const _this = {};
			const getBCHDigit = function(data) {
				let digit = 0;
				while (data != 0) {
					digit += 1;
					data >>>= 1;
				}
				return digit;
			};
			_this.getBCHTypeInfo = function(data) {
				let d = data << 10;
				while (getBCHDigit(d) - getBCHDigit(G15) >= 0) d ^= G15 << getBCHDigit(d) - getBCHDigit(G15);
				return (data << 10 | d) ^ G15_MASK;
			};
			_this.getBCHTypeNumber = function(data) {
				let d = data << 12;
				while (getBCHDigit(d) - getBCHDigit(G18) >= 0) d ^= G18 << getBCHDigit(d) - getBCHDigit(G18);
				return data << 12 | d;
			};
			_this.getPatternPosition = function(typeNumber) {
				return PATTERN_POSITION_TABLE[typeNumber - 1];
			};
			_this.getMaskFunction = function(maskPattern) {
				switch (maskPattern) {
					case QRMaskPattern.PATTERN000: return function(i, j) {
						return (i + j) % 2 == 0;
					};
					case QRMaskPattern.PATTERN001: return function(i, j) {
						return i % 2 == 0;
					};
					case QRMaskPattern.PATTERN010: return function(i, j) {
						return j % 3 == 0;
					};
					case QRMaskPattern.PATTERN011: return function(i, j) {
						return (i + j) % 3 == 0;
					};
					case QRMaskPattern.PATTERN100: return function(i, j) {
						return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 == 0;
					};
					case QRMaskPattern.PATTERN101: return function(i, j) {
						return i * j % 2 + i * j % 3 == 0;
					};
					case QRMaskPattern.PATTERN110: return function(i, j) {
						return (i * j % 2 + i * j % 3) % 2 == 0;
					};
					case QRMaskPattern.PATTERN111: return function(i, j) {
						return (i * j % 3 + (i + j) % 2) % 2 == 0;
					};
					default: throw "bad maskPattern:" + maskPattern;
				}
			};
			_this.getErrorCorrectPolynomial = function(errorCorrectLength) {
				let a = qrPolynomial([1], 0);
				for (let i = 0; i < errorCorrectLength; i += 1) a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0));
				return a;
			};
			_this.getLengthInBits = function(mode, type) {
				if (1 <= type && type < 10) switch (mode) {
					case QRMode.MODE_NUMBER: return 10;
					case QRMode.MODE_ALPHA_NUM: return 9;
					case QRMode.MODE_8BIT_BYTE: return 8;
					case QRMode.MODE_KANJI: return 8;
					default: throw "mode:" + mode;
				}
				else if (type < 27) switch (mode) {
					case QRMode.MODE_NUMBER: return 12;
					case QRMode.MODE_ALPHA_NUM: return 11;
					case QRMode.MODE_8BIT_BYTE: return 16;
					case QRMode.MODE_KANJI: return 10;
					default: throw "mode:" + mode;
				}
				else if (type < 41) switch (mode) {
					case QRMode.MODE_NUMBER: return 14;
					case QRMode.MODE_ALPHA_NUM: return 13;
					case QRMode.MODE_8BIT_BYTE: return 16;
					case QRMode.MODE_KANJI: return 12;
					default: throw "mode:" + mode;
				}
				else throw "type:" + type;
			};
			_this.getLostPoint = function(qrcode) {
				const moduleCount = qrcode.getModuleCount();
				let lostPoint = 0;
				for (let row = 0; row < moduleCount; row += 1) for (let col = 0; col < moduleCount; col += 1) {
					let sameCount = 0;
					const dark = qrcode.isDark(row, col);
					for (let r = -1; r <= 1; r += 1) {
						if (row + r < 0 || moduleCount <= row + r) continue;
						for (let c = -1; c <= 1; c += 1) {
							if (col + c < 0 || moduleCount <= col + c) continue;
							if (r == 0 && c == 0) continue;
							if (dark == qrcode.isDark(row + r, col + c)) sameCount += 1;
						}
					}
					if (sameCount > 5) lostPoint += 3 + sameCount - 5;
				}
				for (let row = 0; row < moduleCount - 1; row += 1) for (let col = 0; col < moduleCount - 1; col += 1) {
					let count = 0;
					if (qrcode.isDark(row, col)) count += 1;
					if (qrcode.isDark(row + 1, col)) count += 1;
					if (qrcode.isDark(row, col + 1)) count += 1;
					if (qrcode.isDark(row + 1, col + 1)) count += 1;
					if (count == 0 || count == 4) lostPoint += 3;
				}
				for (let row = 0; row < moduleCount; row += 1) for (let col = 0; col < moduleCount - 6; col += 1) if (qrcode.isDark(row, col) && !qrcode.isDark(row, col + 1) && qrcode.isDark(row, col + 2) && qrcode.isDark(row, col + 3) && qrcode.isDark(row, col + 4) && !qrcode.isDark(row, col + 5) && qrcode.isDark(row, col + 6)) lostPoint += 40;
				for (let col = 0; col < moduleCount; col += 1) for (let row = 0; row < moduleCount - 6; row += 1) if (qrcode.isDark(row, col) && !qrcode.isDark(row + 1, col) && qrcode.isDark(row + 2, col) && qrcode.isDark(row + 3, col) && qrcode.isDark(row + 4, col) && !qrcode.isDark(row + 5, col) && qrcode.isDark(row + 6, col)) lostPoint += 40;
				let darkCount = 0;
				for (let col = 0; col < moduleCount; col += 1) for (let row = 0; row < moduleCount; row += 1) if (qrcode.isDark(row, col)) darkCount += 1;
				const ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
				lostPoint += ratio * 10;
				return lostPoint;
			};
			return _this;
		}();
		const QRMath = function() {
			const EXP_TABLE = new Array(256);
			const LOG_TABLE = new Array(256);
			for (let i = 0; i < 8; i += 1) EXP_TABLE[i] = 1 << i;
			for (let i = 8; i < 256; i += 1) EXP_TABLE[i] = EXP_TABLE[i - 4] ^ EXP_TABLE[i - 5] ^ EXP_TABLE[i - 6] ^ EXP_TABLE[i - 8];
			for (let i = 0; i < 255; i += 1) LOG_TABLE[EXP_TABLE[i]] = i;
			const _this = {};
			_this.glog = function(n) {
				if (n < 1) throw "glog(" + n + ")";
				return LOG_TABLE[n];
			};
			_this.gexp = function(n) {
				while (n < 0) n += 255;
				while (n >= 256) n -= 255;
				return EXP_TABLE[n];
			};
			return _this;
		}();
		const qrPolynomial = function(num, shift) {
			if (typeof num.length == "undefined") throw num.length + "/" + shift;
			const _num = function() {
				let offset = 0;
				while (offset < num.length && num[offset] == 0) offset += 1;
				const _num = new Array(num.length - offset + shift);
				for (let i = 0; i < num.length - offset; i += 1) _num[i] = num[i + offset];
				return _num;
			}();
			const _this = {};
			_this.getAt = function(index) {
				return _num[index];
			};
			_this.getLength = function() {
				return _num.length;
			};
			_this.multiply = function(e) {
				const num = new Array(_this.getLength() + e.getLength() - 1);
				for (let i = 0; i < _this.getLength(); i += 1) for (let j = 0; j < e.getLength(); j += 1) num[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i)) + QRMath.glog(e.getAt(j)));
				return qrPolynomial(num, 0);
			};
			_this.mod = function(e) {
				if (_this.getLength() - e.getLength() < 0) return _this;
				const ratio = QRMath.glog(_this.getAt(0)) - QRMath.glog(e.getAt(0));
				const num = new Array(_this.getLength());
				for (let i = 0; i < _this.getLength(); i += 1) num[i] = _this.getAt(i);
				for (let i = 0; i < e.getLength(); i += 1) num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i)) + ratio);
				return qrPolynomial(num, 0).mod(e);
			};
			return _this;
		};
		const QRRSBlock = function() {
			const RS_BLOCK_TABLE = [
				[
					1,
					26,
					19
				],
				[
					1,
					26,
					16
				],
				[
					1,
					26,
					13
				],
				[
					1,
					26,
					9
				],
				[
					1,
					44,
					34
				],
				[
					1,
					44,
					28
				],
				[
					1,
					44,
					22
				],
				[
					1,
					44,
					16
				],
				[
					1,
					70,
					55
				],
				[
					1,
					70,
					44
				],
				[
					2,
					35,
					17
				],
				[
					2,
					35,
					13
				],
				[
					1,
					100,
					80
				],
				[
					2,
					50,
					32
				],
				[
					2,
					50,
					24
				],
				[
					4,
					25,
					9
				],
				[
					1,
					134,
					108
				],
				[
					2,
					67,
					43
				],
				[
					2,
					33,
					15,
					2,
					34,
					16
				],
				[
					2,
					33,
					11,
					2,
					34,
					12
				],
				[
					2,
					86,
					68
				],
				[
					4,
					43,
					27
				],
				[
					4,
					43,
					19
				],
				[
					4,
					43,
					15
				],
				[
					2,
					98,
					78
				],
				[
					4,
					49,
					31
				],
				[
					2,
					32,
					14,
					4,
					33,
					15
				],
				[
					4,
					39,
					13,
					1,
					40,
					14
				],
				[
					2,
					121,
					97
				],
				[
					2,
					60,
					38,
					2,
					61,
					39
				],
				[
					4,
					40,
					18,
					2,
					41,
					19
				],
				[
					4,
					40,
					14,
					2,
					41,
					15
				],
				[
					2,
					146,
					116
				],
				[
					3,
					58,
					36,
					2,
					59,
					37
				],
				[
					4,
					36,
					16,
					4,
					37,
					17
				],
				[
					4,
					36,
					12,
					4,
					37,
					13
				],
				[
					2,
					86,
					68,
					2,
					87,
					69
				],
				[
					4,
					69,
					43,
					1,
					70,
					44
				],
				[
					6,
					43,
					19,
					2,
					44,
					20
				],
				[
					6,
					43,
					15,
					2,
					44,
					16
				],
				[
					4,
					101,
					81
				],
				[
					1,
					80,
					50,
					4,
					81,
					51
				],
				[
					4,
					50,
					22,
					4,
					51,
					23
				],
				[
					3,
					36,
					12,
					8,
					37,
					13
				],
				[
					2,
					116,
					92,
					2,
					117,
					93
				],
				[
					6,
					58,
					36,
					2,
					59,
					37
				],
				[
					4,
					46,
					20,
					6,
					47,
					21
				],
				[
					7,
					42,
					14,
					4,
					43,
					15
				],
				[
					4,
					133,
					107
				],
				[
					8,
					59,
					37,
					1,
					60,
					38
				],
				[
					8,
					44,
					20,
					4,
					45,
					21
				],
				[
					12,
					33,
					11,
					4,
					34,
					12
				],
				[
					3,
					145,
					115,
					1,
					146,
					116
				],
				[
					4,
					64,
					40,
					5,
					65,
					41
				],
				[
					11,
					36,
					16,
					5,
					37,
					17
				],
				[
					11,
					36,
					12,
					5,
					37,
					13
				],
				[
					5,
					109,
					87,
					1,
					110,
					88
				],
				[
					5,
					65,
					41,
					5,
					66,
					42
				],
				[
					5,
					54,
					24,
					7,
					55,
					25
				],
				[
					11,
					36,
					12,
					7,
					37,
					13
				],
				[
					5,
					122,
					98,
					1,
					123,
					99
				],
				[
					7,
					73,
					45,
					3,
					74,
					46
				],
				[
					15,
					43,
					19,
					2,
					44,
					20
				],
				[
					3,
					45,
					15,
					13,
					46,
					16
				],
				[
					1,
					135,
					107,
					5,
					136,
					108
				],
				[
					10,
					74,
					46,
					1,
					75,
					47
				],
				[
					1,
					50,
					22,
					15,
					51,
					23
				],
				[
					2,
					42,
					14,
					17,
					43,
					15
				],
				[
					5,
					150,
					120,
					1,
					151,
					121
				],
				[
					9,
					69,
					43,
					4,
					70,
					44
				],
				[
					17,
					50,
					22,
					1,
					51,
					23
				],
				[
					2,
					42,
					14,
					19,
					43,
					15
				],
				[
					3,
					141,
					113,
					4,
					142,
					114
				],
				[
					3,
					70,
					44,
					11,
					71,
					45
				],
				[
					17,
					47,
					21,
					4,
					48,
					22
				],
				[
					9,
					39,
					13,
					16,
					40,
					14
				],
				[
					3,
					135,
					107,
					5,
					136,
					108
				],
				[
					3,
					67,
					41,
					13,
					68,
					42
				],
				[
					15,
					54,
					24,
					5,
					55,
					25
				],
				[
					15,
					43,
					15,
					10,
					44,
					16
				],
				[
					4,
					144,
					116,
					4,
					145,
					117
				],
				[
					17,
					68,
					42
				],
				[
					17,
					50,
					22,
					6,
					51,
					23
				],
				[
					19,
					46,
					16,
					6,
					47,
					17
				],
				[
					2,
					139,
					111,
					7,
					140,
					112
				],
				[
					17,
					74,
					46
				],
				[
					7,
					54,
					24,
					16,
					55,
					25
				],
				[
					34,
					37,
					13
				],
				[
					4,
					151,
					121,
					5,
					152,
					122
				],
				[
					4,
					75,
					47,
					14,
					76,
					48
				],
				[
					11,
					54,
					24,
					14,
					55,
					25
				],
				[
					16,
					45,
					15,
					14,
					46,
					16
				],
				[
					6,
					147,
					117,
					4,
					148,
					118
				],
				[
					6,
					73,
					45,
					14,
					74,
					46
				],
				[
					11,
					54,
					24,
					16,
					55,
					25
				],
				[
					30,
					46,
					16,
					2,
					47,
					17
				],
				[
					8,
					132,
					106,
					4,
					133,
					107
				],
				[
					8,
					75,
					47,
					13,
					76,
					48
				],
				[
					7,
					54,
					24,
					22,
					55,
					25
				],
				[
					22,
					45,
					15,
					13,
					46,
					16
				],
				[
					10,
					142,
					114,
					2,
					143,
					115
				],
				[
					19,
					74,
					46,
					4,
					75,
					47
				],
				[
					28,
					50,
					22,
					6,
					51,
					23
				],
				[
					33,
					46,
					16,
					4,
					47,
					17
				],
				[
					8,
					152,
					122,
					4,
					153,
					123
				],
				[
					22,
					73,
					45,
					3,
					74,
					46
				],
				[
					8,
					53,
					23,
					26,
					54,
					24
				],
				[
					12,
					45,
					15,
					28,
					46,
					16
				],
				[
					3,
					147,
					117,
					10,
					148,
					118
				],
				[
					3,
					73,
					45,
					23,
					74,
					46
				],
				[
					4,
					54,
					24,
					31,
					55,
					25
				],
				[
					11,
					45,
					15,
					31,
					46,
					16
				],
				[
					7,
					146,
					116,
					7,
					147,
					117
				],
				[
					21,
					73,
					45,
					7,
					74,
					46
				],
				[
					1,
					53,
					23,
					37,
					54,
					24
				],
				[
					19,
					45,
					15,
					26,
					46,
					16
				],
				[
					5,
					145,
					115,
					10,
					146,
					116
				],
				[
					19,
					75,
					47,
					10,
					76,
					48
				],
				[
					15,
					54,
					24,
					25,
					55,
					25
				],
				[
					23,
					45,
					15,
					25,
					46,
					16
				],
				[
					13,
					145,
					115,
					3,
					146,
					116
				],
				[
					2,
					74,
					46,
					29,
					75,
					47
				],
				[
					42,
					54,
					24,
					1,
					55,
					25
				],
				[
					23,
					45,
					15,
					28,
					46,
					16
				],
				[
					17,
					145,
					115
				],
				[
					10,
					74,
					46,
					23,
					75,
					47
				],
				[
					10,
					54,
					24,
					35,
					55,
					25
				],
				[
					19,
					45,
					15,
					35,
					46,
					16
				],
				[
					17,
					145,
					115,
					1,
					146,
					116
				],
				[
					14,
					74,
					46,
					21,
					75,
					47
				],
				[
					29,
					54,
					24,
					19,
					55,
					25
				],
				[
					11,
					45,
					15,
					46,
					46,
					16
				],
				[
					13,
					145,
					115,
					6,
					146,
					116
				],
				[
					14,
					74,
					46,
					23,
					75,
					47
				],
				[
					44,
					54,
					24,
					7,
					55,
					25
				],
				[
					59,
					46,
					16,
					1,
					47,
					17
				],
				[
					12,
					151,
					121,
					7,
					152,
					122
				],
				[
					12,
					75,
					47,
					26,
					76,
					48
				],
				[
					39,
					54,
					24,
					14,
					55,
					25
				],
				[
					22,
					45,
					15,
					41,
					46,
					16
				],
				[
					6,
					151,
					121,
					14,
					152,
					122
				],
				[
					6,
					75,
					47,
					34,
					76,
					48
				],
				[
					46,
					54,
					24,
					10,
					55,
					25
				],
				[
					2,
					45,
					15,
					64,
					46,
					16
				],
				[
					17,
					152,
					122,
					4,
					153,
					123
				],
				[
					29,
					74,
					46,
					14,
					75,
					47
				],
				[
					49,
					54,
					24,
					10,
					55,
					25
				],
				[
					24,
					45,
					15,
					46,
					46,
					16
				],
				[
					4,
					152,
					122,
					18,
					153,
					123
				],
				[
					13,
					74,
					46,
					32,
					75,
					47
				],
				[
					48,
					54,
					24,
					14,
					55,
					25
				],
				[
					42,
					45,
					15,
					32,
					46,
					16
				],
				[
					20,
					147,
					117,
					4,
					148,
					118
				],
				[
					40,
					75,
					47,
					7,
					76,
					48
				],
				[
					43,
					54,
					24,
					22,
					55,
					25
				],
				[
					10,
					45,
					15,
					67,
					46,
					16
				],
				[
					19,
					148,
					118,
					6,
					149,
					119
				],
				[
					18,
					75,
					47,
					31,
					76,
					48
				],
				[
					34,
					54,
					24,
					34,
					55,
					25
				],
				[
					20,
					45,
					15,
					61,
					46,
					16
				]
			];
			const qrRSBlock = function(totalCount, dataCount) {
				const _this = {};
				_this.totalCount = totalCount;
				_this.dataCount = dataCount;
				return _this;
			};
			const _this = {};
			const getRsBlockTable = function(typeNumber, errorCorrectionLevel) {
				switch (errorCorrectionLevel) {
					case QRErrorCorrectionLevel.L: return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
					case QRErrorCorrectionLevel.M: return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
					case QRErrorCorrectionLevel.Q: return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
					case QRErrorCorrectionLevel.H: return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
					default: return;
				}
			};
			_this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {
				const rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);
				if (typeof rsBlock == "undefined") throw "bad rs block @ typeNumber:" + typeNumber + "/errorCorrectionLevel:" + errorCorrectionLevel;
				const length = rsBlock.length / 3;
				const list = [];
				for (let i = 0; i < length; i += 1) {
					const count = rsBlock[i * 3 + 0];
					const totalCount = rsBlock[i * 3 + 1];
					const dataCount = rsBlock[i * 3 + 2];
					for (let j = 0; j < count; j += 1) list.push(qrRSBlock(totalCount, dataCount));
				}
				return list;
			};
			return _this;
		}();
		const qrBitBuffer = function() {
			const _buffer = [];
			let _length = 0;
			const _this = {};
			_this.getBuffer = function() {
				return _buffer;
			};
			_this.getAt = function(index) {
				const bufIndex = Math.floor(index / 8);
				return (_buffer[bufIndex] >>> 7 - index % 8 & 1) == 1;
			};
			_this.put = function(num, length) {
				for (let i = 0; i < length; i += 1) _this.putBit((num >>> length - i - 1 & 1) == 1);
			};
			_this.getLengthInBits = function() {
				return _length;
			};
			_this.putBit = function(bit) {
				const bufIndex = Math.floor(_length / 8);
				if (_buffer.length <= bufIndex) _buffer.push(0);
				if (bit) _buffer[bufIndex] |= 128 >>> _length % 8;
				_length += 1;
			};
			return _this;
		};
		const qrNumber = function(data) {
			const _mode = QRMode.MODE_NUMBER;
			const _data = data;
			const _this = {};
			_this.getMode = function() {
				return _mode;
			};
			_this.getLength = function(buffer) {
				return _data.length;
			};
			_this.write = function(buffer) {
				const data = _data;
				let i = 0;
				while (i + 2 < data.length) {
					buffer.put(strToNum(data.substring(i, i + 3)), 10);
					i += 3;
				}
				if (i < data.length) {
					if (data.length - i == 1) buffer.put(strToNum(data.substring(i, i + 1)), 4);
					else if (data.length - i == 2) buffer.put(strToNum(data.substring(i, i + 2)), 7);
				}
			};
			const strToNum = function(s) {
				let num = 0;
				for (let i = 0; i < s.length; i += 1) num = num * 10 + chatToNum(s.charAt(i));
				return num;
			};
			const chatToNum = function(c) {
				if ("0" <= c && c <= "9") return c.charCodeAt(0) - "0".charCodeAt(0);
				throw "illegal char :" + c;
			};
			return _this;
		};
		const qrAlphaNum = function(data) {
			const _mode = QRMode.MODE_ALPHA_NUM;
			const _data = data;
			const _this = {};
			_this.getMode = function() {
				return _mode;
			};
			_this.getLength = function(buffer) {
				return _data.length;
			};
			_this.write = function(buffer) {
				const s = _data;
				let i = 0;
				while (i + 1 < s.length) {
					buffer.put(getCode(s.charAt(i)) * 45 + getCode(s.charAt(i + 1)), 11);
					i += 2;
				}
				if (i < s.length) buffer.put(getCode(s.charAt(i)), 6);
			};
			const getCode = function(c) {
				if ("0" <= c && c <= "9") return c.charCodeAt(0) - "0".charCodeAt(0);
				else if ("A" <= c && c <= "Z") return c.charCodeAt(0) - "A".charCodeAt(0) + 10;
				else switch (c) {
					case " ": return 36;
					case "$": return 37;
					case "%": return 38;
					case "*": return 39;
					case "+": return 40;
					case "-": return 41;
					case ".": return 42;
					case "/": return 43;
					case ":": return 44;
					default: throw "illegal char :" + c;
				}
			};
			return _this;
		};
		const qr8BitByte = function(data) {
			const _mode = QRMode.MODE_8BIT_BYTE;
			const _bytes = qrcode.stringToBytes(data);
			const _this = {};
			_this.getMode = function() {
				return _mode;
			};
			_this.getLength = function(buffer) {
				return _bytes.length;
			};
			_this.write = function(buffer) {
				for (let i = 0; i < _bytes.length; i += 1) buffer.put(_bytes[i], 8);
			};
			return _this;
		};
		const qrKanji = function(data) {
			const _mode = QRMode.MODE_KANJI;
			const stringToBytes = qrcode.stringToBytes;
			(function(c, code) {
				const test = stringToBytes(c);
				if (test.length != 2 || (test[0] << 8 | test[1]) != code) throw "sjis not supported.";
			})("友", 38726);
			const _bytes = stringToBytes(data);
			const _this = {};
			_this.getMode = function() {
				return _mode;
			};
			_this.getLength = function(buffer) {
				return ~~(_bytes.length / 2);
			};
			_this.write = function(buffer) {
				const data = _bytes;
				let i = 0;
				while (i + 1 < data.length) {
					let c = (255 & data[i]) << 8 | 255 & data[i + 1];
					if (33088 <= c && c <= 40956) c -= 33088;
					else if (57408 <= c && c <= 60351) c -= 49472;
					else throw "illegal char at " + (i + 1) + "/" + c;
					c = (c >>> 8 & 255) * 192 + (c & 255);
					buffer.put(c, 13);
					i += 2;
				}
				if (i < data.length) throw "illegal char at " + (i + 1);
			};
			return _this;
		};
		const byteArrayOutputStream = function() {
			const _bytes = [];
			const _this = {};
			_this.writeByte = function(b) {
				_bytes.push(b & 255);
			};
			_this.writeShort = function(i) {
				_this.writeByte(i);
				_this.writeByte(i >>> 8);
			};
			_this.writeBytes = function(b, off, len) {
				off = off || 0;
				len = len || b.length;
				for (let i = 0; i < len; i += 1) _this.writeByte(b[i + off]);
			};
			_this.writeString = function(s) {
				for (let i = 0; i < s.length; i += 1) _this.writeByte(s.charCodeAt(i));
			};
			_this.toByteArray = function() {
				return _bytes;
			};
			_this.toString = function() {
				let s = "";
				s += "[";
				for (let i = 0; i < _bytes.length; i += 1) {
					if (i > 0) s += ",";
					s += _bytes[i];
				}
				s += "]";
				return s;
			};
			return _this;
		};
		const base64EncodeOutputStream = function() {
			let _buffer = 0;
			let _buflen = 0;
			let _length = 0;
			let _base64 = "";
			const _this = {};
			const writeEncoded = function(b) {
				_base64 += String.fromCharCode(encode(b & 63));
			};
			const encode = function(n) {
				if (n < 0) throw "n:" + n;
				else if (n < 26) return 65 + n;
				else if (n < 52) return 97 + (n - 26);
				else if (n < 62) return 48 + (n - 52);
				else if (n == 62) return 43;
				else if (n == 63) return 47;
				else throw "n:" + n;
			};
			_this.writeByte = function(n) {
				_buffer = _buffer << 8 | n & 255;
				_buflen += 8;
				_length += 1;
				while (_buflen >= 6) {
					writeEncoded(_buffer >>> _buflen - 6);
					_buflen -= 6;
				}
			};
			_this.flush = function() {
				if (_buflen > 0) {
					writeEncoded(_buffer << 6 - _buflen);
					_buffer = 0;
					_buflen = 0;
				}
				if (_length % 3 != 0) {
					const padlen = 3 - _length % 3;
					for (let i = 0; i < padlen; i += 1) _base64 += "=";
				}
			};
			_this.toString = function() {
				return _base64;
			};
			return _this;
		};
		const base64DecodeInputStream = function(str) {
			const _str = str;
			let _pos = 0;
			let _buffer = 0;
			let _buflen = 0;
			const _this = {};
			_this.read = function() {
				while (_buflen < 8) {
					if (_pos >= _str.length) {
						if (_buflen == 0) return -1;
						throw "unexpected end of file./" + _buflen;
					}
					const c = _str.charAt(_pos);
					_pos += 1;
					if (c == "=") {
						_buflen = 0;
						return -1;
					} else if (c.match(/^\s$/)) continue;
					_buffer = _buffer << 6 | decode(c.charCodeAt(0));
					_buflen += 6;
				}
				const n = _buffer >>> _buflen - 8 & 255;
				_buflen -= 8;
				return n;
			};
			const decode = function(c) {
				if (65 <= c && c <= 90) return c - 65;
				else if (97 <= c && c <= 122) return c - 97 + 26;
				else if (48 <= c && c <= 57) return c - 48 + 52;
				else if (c == 43) return 62;
				else if (c == 47) return 63;
				else throw "c:" + c;
			};
			return _this;
		};
		const gifImage = function(width, height) {
			const _width = width;
			const _height = height;
			const _data = new Array(width * height);
			const _this = {};
			_this.setPixel = function(x, y, pixel) {
				_data[y * _width + x] = pixel;
			};
			_this.write = function(out) {
				out.writeString("GIF87a");
				out.writeShort(_width);
				out.writeShort(_height);
				out.writeByte(128);
				out.writeByte(0);
				out.writeByte(0);
				out.writeByte(0);
				out.writeByte(0);
				out.writeByte(0);
				out.writeByte(255);
				out.writeByte(255);
				out.writeByte(255);
				out.writeString(",");
				out.writeShort(0);
				out.writeShort(0);
				out.writeShort(_width);
				out.writeShort(_height);
				out.writeByte(0);
				const lzwMinCodeSize = 2;
				const raster = getLZWRaster(lzwMinCodeSize);
				out.writeByte(lzwMinCodeSize);
				let offset = 0;
				while (raster.length - offset > 255) {
					out.writeByte(255);
					out.writeBytes(raster, offset, 255);
					offset += 255;
				}
				out.writeByte(raster.length - offset);
				out.writeBytes(raster, offset, raster.length - offset);
				out.writeByte(0);
				out.writeString(";");
			};
			const bitOutputStream = function(out) {
				const _out = out;
				let _bitLength = 0;
				let _bitBuffer = 0;
				const _this = {};
				_this.write = function(data, length) {
					if (data >>> length != 0) throw "length over";
					while (_bitLength + length >= 8) {
						_out.writeByte(255 & (data << _bitLength | _bitBuffer));
						length -= 8 - _bitLength;
						data >>>= 8 - _bitLength;
						_bitBuffer = 0;
						_bitLength = 0;
					}
					_bitBuffer = data << _bitLength | _bitBuffer;
					_bitLength = _bitLength + length;
				};
				_this.flush = function() {
					if (_bitLength > 0) _out.writeByte(_bitBuffer);
				};
				return _this;
			};
			const getLZWRaster = function(lzwMinCodeSize) {
				const clearCode = 1 << lzwMinCodeSize;
				const endCode = (1 << lzwMinCodeSize) + 1;
				let bitLength = lzwMinCodeSize + 1;
				const table = lzwTable();
				for (let i = 0; i < clearCode; i += 1) table.add(String.fromCharCode(i));
				table.add(String.fromCharCode(clearCode));
				table.add(String.fromCharCode(endCode));
				const byteOut = byteArrayOutputStream();
				const bitOut = bitOutputStream(byteOut);
				bitOut.write(clearCode, bitLength);
				let dataIndex = 0;
				let s = String.fromCharCode(_data[dataIndex]);
				dataIndex += 1;
				while (dataIndex < _data.length) {
					const c = String.fromCharCode(_data[dataIndex]);
					dataIndex += 1;
					if (table.contains(s + c)) s = s + c;
					else {
						bitOut.write(table.indexOf(s), bitLength);
						if (table.size() < 4095) {
							if (table.size() == 1 << bitLength) bitLength += 1;
							table.add(s + c);
						}
						s = c;
					}
				}
				bitOut.write(table.indexOf(s), bitLength);
				bitOut.write(endCode, bitLength);
				bitOut.flush();
				return byteOut.toByteArray();
			};
			const lzwTable = function() {
				const _map = {};
				let _size = 0;
				const _this = {};
				_this.add = function(key) {
					if (_this.contains(key)) throw "dup key:" + key;
					_map[key] = _size;
					_size += 1;
				};
				_this.size = function() {
					return _size;
				};
				_this.indexOf = function(key) {
					return _map[key];
				};
				_this.contains = function(key) {
					return typeof _map[key] != "undefined";
				};
				return _this;
			};
			return _this;
		};
		const createDataURL = function(width, height, getPixel) {
			const gif = gifImage(width, height);
			for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) gif.setPixel(x, y, getPixel(x, y));
			const b = byteArrayOutputStream();
			gif.write(b);
			const base64 = base64EncodeOutputStream();
			const bytes = b.toByteArray();
			for (let i = 0; i < bytes.length; i += 1) base64.writeByte(bytes[i]);
			base64.flush();
			return "data:image/gif;base64," + base64;
		};
		qrcode.stringToBytes;
		//#endregion
		//#region \0dsh-css:D:\Desktop\DeepSeek Harness\dsh-web-ui-0.1.10\packages\dsh-usage-dashboard\src\client\usage.module.css.mjs
		const css$2 = ".lkZm-a_overlay{z-index:2147483001;justify-content:center;align-items:center;display:flex;position:fixed;inset:0}.lkZm-a_mask{-webkit-backdrop-filter:blur(6px);background:#050814b8;position:absolute;inset:0}.lkZm-a_panel{z-index:1;box-sizing:border-box;color:#e6eaff;background:linear-gradient(165deg,#141a34f5,#0a0e1efa);border:1px solid #8ca0ff40;border-radius:20px;flex-direction:column;width:880px;max-width:calc(100vw - 48px);max-height:calc(100vh - 48px);padding:22px 26px;font-size:13px;display:flex;position:relative;overflow:auto;box-shadow:0 18px 60px #0000008c,inset 0 1px #ffffff0f}.lkZm-a_header{justify-content:space-between;align-items:center;margin-bottom:16px;display:flex}.lkZm-a_title{background:linear-gradient(90deg,#f472b6,#fb923c,#facc15,#4ade80,#22d3ee,#818cf8);color:#0000;-webkit-background-clip:text;background-clip:text;margin:0;font-size:18px;font-weight:700}.lkZm-a_close{color:#b9c2e8;cursor:pointer;background:#8ca0ff1f;border:none;border-radius:8px;flex:none;justify-content:center;align-items:center;width:30px;height:30px;transition:background .12s,color .12s;display:inline-flex}.lkZm-a_close:hover{color:#fff;background:#8ca0ff3d}.lkZm-a_body{flex-direction:column;gap:18px;display:flex}.lkZm-a_statGrid{grid-template-columns:repeat(4,1fr);gap:12px;display:grid}.lkZm-a_statCard{border:1px solid;border-radius:14px;flex-direction:column;gap:3px;padding:14px 16px;display:flex}.lkZm-a_statValue{font-variant-numeric:tabular-nums;font-size:26px;font-weight:800;line-height:1.1}.lkZm-a_statLabel{color:#e6eaffd9;font-size:12px;font-weight:600}.lkZm-a_statSub{color:#e6eaff8c;font-size:11px}.lkZm-a_section{flex-direction:column;gap:6px;display:flex}.lkZm-a_sectionTitle{color:#e6eaff;font-size:13px;font-weight:700}.lkZm-a_sectionSub{color:#e6eaff80;font-size:11px}.lkZm-a_twoCol{grid-template-columns:1fr 1.2fr;align-items:start;gap:20px;display:grid}.lkZm-a_chart{width:100%;height:auto;margin-top:4px}.lkZm-a_axisLabel{fill:#e6eaff73;font-size:9px}.lkZm-a_donutWrap{align-items:center;gap:16px;display:flex}.lkZm-a_donut{flex:none;width:150px;height:150px}.lkZm-a_donutTotal{fill:#e6eaff;font-size:16px;font-weight:800}.lkZm-a_donutLabel{fill:#e6eaff80;font-size:9px}.lkZm-a_legend{flex-direction:column;gap:5px;min-width:0;display:flex}.lkZm-a_legendRow{align-items:center;gap:7px;font-size:11px;display:flex}.lkZm-a_legendDot{border-radius:3px;flex:none;width:9px;height:9px}.lkZm-a_legendName{text-overflow:ellipsis;white-space:nowrap;color:#e6eaffd9;flex:1;min-width:0;overflow:hidden}.lkZm-a_legendVal{font-variant-numeric:tabular-nums;color:#e6eaff99}.lkZm-a_sessionList{flex-direction:column;gap:9px;max-height:320px;display:flex;overflow:auto}.lkZm-a_sessionRow{align-items:center;gap:10px;display:flex}.lkZm-a_sessionRank{text-align:center;flex:none;width:20px;font-size:14px;font-weight:800}.lkZm-a_sessionInfo{flex-direction:column;flex:1;gap:2px;min-width:0;display:flex}.lkZm-a_sessionName{color:#e6eaff;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:600;overflow:hidden}.lkZm-a_sessionMeta{color:#e6eaff80;font-size:10px}.lkZm-a_sessionBar{background:#8ca0ff1f;border-radius:999px;height:4px;margin-top:2px;overflow:hidden}.lkZm-a_sessionBarFill{border-radius:999px;height:100%;transition:width .4s}.lkZm-a_sessionTokens{font-variant-numeric:tabular-nums;color:#e6eaff;flex-direction:column;flex:none;align-items:flex-end;gap:2px;font-size:12px;font-weight:700;display:flex}.lkZm-a_sessionCost{color:#e6eaff8c;font-size:10px;font-weight:600}.lkZm-a_empty{flex-direction:column;align-items:center;gap:8px;padding:60px 0;display:flex}.lkZm-a_emptyTitle{color:#e6eaffbf;font-size:15px;font-weight:700}.lkZm-a_emptyHint{color:#e6eaff73;text-align:center;font-size:12px;line-height:1.6}.lkZm-a_error{color:#fca5a5;background:#f8717124;border:1px solid #f8717159;border-radius:10px;padding:10px 14px;font-size:12px}@media (width<=720px){.lkZm-a_panel{border-radius:0;width:100%;max-width:100vw;max-height:100vh;padding:16px}.lkZm-a_statGrid,.lkZm-a_twoCol{grid-template-columns:1fr}}";
		const tagId$2 = "@captain1275/dsh-usage-dashboard/usage.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@captain1275/dsh-usage-dashboard";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var usage_module_css_default = {
			"axisLabel": "lkZm-a_axisLabel",
			"body": "lkZm-a_body",
			"chart": "lkZm-a_chart",
			"close": "lkZm-a_close",
			"donut": "lkZm-a_donut",
			"donutLabel": "lkZm-a_donutLabel",
			"donutTotal": "lkZm-a_donutTotal",
			"donutWrap": "lkZm-a_donutWrap",
			"empty": "lkZm-a_empty",
			"emptyHint": "lkZm-a_emptyHint",
			"emptyTitle": "lkZm-a_emptyTitle",
			"error": "lkZm-a_error",
			"header": "lkZm-a_header",
			"legend": "lkZm-a_legend",
			"legendDot": "lkZm-a_legendDot",
			"legendName": "lkZm-a_legendName",
			"legendRow": "lkZm-a_legendRow",
			"legendVal": "lkZm-a_legendVal",
			"mask": "lkZm-a_mask",
			"overlay": "lkZm-a_overlay",
			"panel": "lkZm-a_panel",
			"section": "lkZm-a_section",
			"sectionSub": "lkZm-a_sectionSub",
			"sectionTitle": "lkZm-a_sectionTitle",
			"sessionBar": "lkZm-a_sessionBar",
			"sessionBarFill": "lkZm-a_sessionBarFill",
			"sessionCost": "lkZm-a_sessionCost",
			"sessionInfo": "lkZm-a_sessionInfo",
			"sessionList": "lkZm-a_sessionList",
			"sessionMeta": "lkZm-a_sessionMeta",
			"sessionName": "lkZm-a_sessionName",
			"sessionRank": "lkZm-a_sessionRank",
			"sessionRow": "lkZm-a_sessionRow",
			"sessionTokens": "lkZm-a_sessionTokens",
			"statCard": "lkZm-a_statCard",
			"statGrid": "lkZm-a_statGrid",
			"statLabel": "lkZm-a_statLabel",
			"statSub": "lkZm-a_statSub",
			"statValue": "lkZm-a_statValue",
			"title": "lkZm-a_title",
			"twoCol": "lkZm-a_twoCol"
		};
		//#endregion
		//#region src/client/locales.ts
		/**
		* dsh-usage-dashboard locale copy (zh source of truth, en mirror).
		* @module @captain1275/dsh-usage-dashboard/client/locales
		*/
		const NS = "usage-dashboard";
		const zh = {
			"usage.entry": "用量",
			"usage.title": "用量看板",
			"usage.total": "累计用量",
			"usage.today": "今日",
			"usage.calls": "调用",
			"usage.input": "输入",
			"usage.output": "输出",
			"usage.cache": "缓存",
			"usage.trend": "近 14 天趋势",
			"usage.trendDetail": "每日 token 消耗（输入 + 输出 + 缓存）",
			"usage.sessions": "会话排行",
			"usage.models": "模型分布",
			"usage.tokens": "token",
			"usage.close": "关闭用量看板",
			"usage.empty": "暂无用量数据",
			"usage.noData": "使用 DSH 对话后，这里会显示详细用量统计。",
			"usage.settingsTitle": "用量看板",
			"usage.settingsHint": "记录每次响应的 token 用量并展示彩色统计看板。"
		};
		const en = {
			"usage.entry": "Usage",
			"usage.title": "Usage Dashboard",
			"usage.total": "Total usage",
			"usage.today": "Today",
			"usage.calls": "calls",
			"usage.input": "Input",
			"usage.output": "Output",
			"usage.cache": "Cache",
			"usage.trend": "Last 14 days",
			"usage.trendDetail": "Daily token usage (input + output + cache)",
			"usage.sessions": "Top sessions",
			"usage.models": "Model distribution",
			"usage.tokens": "tokens",
			"usage.close": "Close usage dashboard",
			"usage.empty": "No usage data yet",
			"usage.noData": "Start chatting with DSH and detailed usage stats will appear here.",
			"usage.settingsTitle": "Usage dashboard",
			"usage.settingsHint": "Records per-response token usage and renders a colorful stats dashboard."
		};
		/** Translate helper bound to the usage namespace (component-local). */
		function t(key, params) {
			let text = (typeof document !== "undefined" && document.documentElement.lang === "en" ? en : zh)[key] ?? key;
			for (const [name, value] of Object.entries(params ?? {})) text = text.replaceAll(`{${name}}`, String(value));
			return text;
		}
		//#endregion
		//#region src/client/DashboardPanel.tsx
		/**
		* Usage dashboard panel — the colorful full-screen overlay. Reads the host
		* `/api/usage/summary` and renders: rainbow stat cards, a 14-day bar chart,
		* a model-donut chart, and a session ranking table. Hand-drawn SVG, no chart
		* library.
		* @module @captain1275/dsh-usage-dashboard/client/DashboardPanel
		*/
		/** 看板彩色盘（五颜六色）。 */
		const RAINBOW = [
			"#f472b6",
			"#fb923c",
			"#facc15",
			"#4ade80",
			"#22d3ee",
			"#818cf8",
			"#c084fc",
			"#f87171"
		];
		/** 数值格式化：千分位 + 大数缩写。 */
		function fmt(n) {
			if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
			if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
			return String(n);
		}
		/** 十六进制颜色转 rgba。 */
		function hexToRgba(hex, alpha) {
			const v = parseInt(hex.slice(1), 16);
			return `rgba(${v >> 16 & 255}, ${v >> 8 & 255}, ${v & 255}, ${alpha})`;
		}
		/** 费用格式化：¥X.XX，小额保留 4 位。 */
		function fmtCost(n) {
			if (n >= 100) return `¥${Math.round(n)}`;
			if (n >= 1) return `¥${n.toFixed(2)}`;
			return `¥${n.toFixed(4)}`;
		}
		/** 拉取看板数据。 */
		async function fetchSummary() {
			const res = await fetch("/api/usage/summary");
			if (!res.ok) throw new Error(`usage summary failed: ${res.status}`);
			return await res.json();
		}
		/** 彩色统计卡片。 */
		function StatCard(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: usage_module_css_default.statCard,
				style: {
					background: `linear-gradient(135deg, ${hexToRgba(props.color, .22)}, ${hexToRgba(props.color, .05)})`,
					borderColor: hexToRgba(props.color, .4)
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: usage_module_css_default.statValue,
						style: { color: props.color },
						children: props.value
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: usage_module_css_default.statLabel,
						children: props.label
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: usage_module_css_default.statSub,
						children: props.sub
					})
				]
			});
		}
		/** 近 14 天柱状图（SVG）。 */
		function TrendChart(props) {
			const W = 560;
			const H = 160;
			const PAD = {
				left: 8,
				right: 8,
				top: 12,
				bottom: 24
			};
			const max = Math.max(1, ...props.recent.map((d) => d.inputTokens + d.outputTokens));
			const innerW = W - PAD.left - PAD.right;
			const innerH = H - PAD.top - PAD.bottom;
			const barW = innerW / props.recent.length;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				className: usage_module_css_default.chart,
				viewBox: `0 0 ${W} ${H}`,
				role: "img",
				"aria-label": t("usage.trend"),
				children: props.recent.map((d, i) => {
					const total = d.inputTokens + d.outputTokens;
					const h = total === 0 ? 0 : Math.max(2, total / max * innerH);
					const x = PAD.left + i * barW;
					const y = PAD.top + innerH - h;
					const color = RAINBOW[i % RAINBOW.length];
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: x + barW * .18,
						y,
						width: barW * .64,
						height: h,
						rx: 3,
						fill: color,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("title", { children: `${d.day}: ${fmt(total)} tokens` })
					}), props.recent.length <= 14 && i % 2 === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
						x: x + barW / 2,
						y: H - 8,
						textAnchor: "middle",
						className: usage_module_css_default.axisLabel,
						children: d.day.slice(5)
					})] }, d.day);
				})
			});
		}
		/** 模型分布环形图（SVG）。 */
		function ModelDonut(props) {
			const entries = Object.entries(props.byModel).sort((a, b) => b[1].inputTokens + b[1].outputTokens - (a[1].inputTokens + a[1].outputTokens));
			const total = entries.reduce((acc, [, v]) => acc + v.inputTokens + v.outputTokens, 0);
			const R = 56;
			const CX = 90;
			const CY = 90;
			const STROKE = 26;
			const CIRC = 2 * Math.PI * R;
			let acc = 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: usage_module_css_default.donutWrap,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
					viewBox: "0 0 180 180",
					className: usage_module_css_default.donut,
					role: "img",
					"aria-label": t("usage.models"),
					children: [
						entries.map(([name, v], i) => {
							const frac = total === 0 ? 0 : (v.inputTokens + v.outputTokens) / total;
							const dash = frac * CIRC;
							const offset = -(acc * CIRC);
							acc += frac;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
								cx: CX,
								cy: CY,
								r: R,
								fill: "none",
								stroke: RAINBOW[i % RAINBOW.length],
								strokeWidth: STROKE,
								strokeDasharray: `${dash} ${CIRC - dash}`,
								strokeDashoffset: offset,
								strokeLinecap: "butt",
								transform: `rotate(-90 ${CX} ${CY})`,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("title", { children: `${name}: ${fmt(v.inputTokens + v.outputTokens)} tokens` })
							}, name);
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
							x: CX,
							y: CY - 2,
							textAnchor: "middle",
							className: usage_module_css_default.donutTotal,
							children: fmt(total)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
							x: CX,
							y: 104,
							textAnchor: "middle",
							className: usage_module_css_default.donutLabel,
							children: t("usage.tokens")
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: usage_module_css_default.legend,
					children: entries.map(([name, v], i) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: usage_module_css_default.legendRow,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_module_css_default.legendDot,
								style: { background: RAINBOW[i % RAINBOW.length] }
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_module_css_default.legendName,
								children: name
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_module_css_default.legendVal,
								children: fmt(v.inputTokens + v.outputTokens)
							})
						]
					}, name))
				})]
			});
		}
		/**
		* The dashboard overlay panel.
		* @param props - onClose callback.
		* @returns portal element tree.
		*/
		function DashboardPanel(props) {
			const [summary, setSummary] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const load = (0, react.useCallback)(() => {
				setError(null);
				fetchSummary().then(setSummary).catch((e) => setError(e instanceof Error ? e.message : String(e)));
			}, []);
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			const hasData = summary !== null && summary.total.calls > 0;
			const totalTokens = summary === null ? 0 : summary.total.inputTokens + summary.total.outputTokens + summary.total.cacheReadTokens;
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: usage_module_css_default.overlay,
				role: "presentation",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: usage_module_css_default.mask,
					"aria-hidden": "true",
					onClick: props.onClose
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: usage_module_css_default.panel,
					role: "dialog",
					"aria-modal": "true",
					"aria-label": t("usage.title"),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: usage_module_css_default.header,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
								className: usage_module_css_default.title,
								children: t("usage.title")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: usage_module_css_default.close,
								"aria-label": t("usage.close"),
								onClick: props.onClose,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
									viewBox: "0 0 16 16",
									width: "16",
									height: "16",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
										d: "M4 4l8 8M12 4l-8 8",
										stroke: "currentColor",
										strokeWidth: "1.6",
										strokeLinecap: "round"
									})
								})
							})]
						}),
						error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: usage_module_css_default.error,
							children: error
						}),
						summary !== null && !hasData && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: usage_module_css_default.empty,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: usage_module_css_default.emptyTitle,
								children: t("usage.empty")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: usage_module_css_default.emptyHint,
								children: t("usage.noData")
							})]
						}),
						summary !== null && hasData && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: usage_module_css_default.body,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: usage_module_css_default.statGrid,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatCard, {
											label: t("usage.total"),
											value: fmt(totalTokens),
											sub: `${fmt(summary.total.inputTokens)} in / ${fmt(summary.total.outputTokens)} out`,
											color: RAINBOW[0]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatCard, {
											label: t("usage.calls"),
											value: fmt(summary.total.calls),
											sub: `${summary.byDayCount} 天有记录`,
											color: RAINBOW[1]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatCard, {
											label: t("usage.cache"),
											value: fmt(summary.total.cacheReadTokens),
											sub: "缓存命中",
											color: RAINBOW[2]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatCard, {
											label: "估算费用",
											value: fmtCost(summary.cost?.total ?? 0),
											sub: "按 DeepSeek 定价估算",
											color: RAINBOW[3]
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: usage_module_css_default.section,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: usage_module_css_default.sectionTitle,
											children: t("usage.trend")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: usage_module_css_default.sectionSub,
											children: t("usage.trendDetail")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TrendChart, { recent: summary.recent })
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: usage_module_css_default.twoCol,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: usage_module_css_default.section,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: usage_module_css_default.sectionTitle,
											children: t("usage.models")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelDonut, { byModel: summary.byModel })]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: usage_module_css_default.section,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: usage_module_css_default.sectionTitle,
											children: t("usage.sessions")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: usage_module_css_default.sessionList,
											children: summary.sessions.map((s, i) => {
												const max = summary.sessions[0]?.totalTokens ?? 1;
												const pct = Math.max(2, Math.round(s.totalTokens / max * 100));
												const color = RAINBOW[i % RAINBOW.length];
												return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: usage_module_css_default.sessionRow,
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: usage_module_css_default.sessionRank,
															style: { color },
															children: i + 1
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
															className: usage_module_css_default.sessionInfo,
															children: [
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																	className: usage_module_css_default.sessionName,
																	children: s.title
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																	className: usage_module_css_default.sessionMeta,
																	children: [
																		s.model,
																		" · ",
																		s.calls,
																		" ",
																		t("usage.calls")
																	]
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																	className: usage_module_css_default.sessionBar,
																	children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																		className: usage_module_css_default.sessionBarFill,
																		style: {
																			width: `${pct}%`,
																			background: color
																		}
																	})
																})
															]
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
															className: usage_module_css_default.sessionTokens,
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: fmt(s.totalTokens) }), s.cost !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																className: usage_module_css_default.sessionCost,
																children: fmtCost(s.cost)
															})]
														})
													]
												}, s.id);
											})
										})]
									})]
								})
							]
						})
					]
				})]
			}), document.body);
		}
		//#endregion
		//#region \0dsh-css:D:\Desktop\DeepSeek Harness\dsh-web-ui-0.1.10\packages\dsh-usage-dashboard\src\client\usage-entry.module.css.mjs
		const css$1 = ".oI3yBG_entry{width:100%;height:32px;color:var(--dsw-alias-label-secondary);cursor:pointer;white-space:nowrap;background:0 0;border:none;border-radius:8px;align-items:center;gap:8px;padding:0 12px;font-size:13px;transition:background-color .12s,color .12s;display:flex}.oI3yBG_entry:hover{background:var(--dsw-specific-sidebar-nav-item-hover);color:var(--dsw-alias-label-primary)}.oI3yBG_entry:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}.oI3yBG_entryIcon{flex:none;justify-content:center;align-items:center;display:inline-flex}.oI3yBG_entryLabel{text-overflow:ellipsis;overflow:hidden}[data-dsh-frame][data-sidebar-collapsed] .oI3yBG_entry{justify-content:center;width:100%;padding:0}[data-dsh-frame][data-sidebar-collapsed] .oI3yBG_entryLabel{display:none}.oI3yBG_phoneOverlay{z-index:9999;backdrop-filter:blur(6px);background:#0000002e;justify-content:center;align-items:center;padding:16px;display:flex;position:fixed;inset:0}.oI3yBG_phoneCard{backdrop-filter:blur(30px);background:#1019266b;border:1px solid #ffffff14;border-radius:14px;width:320px;max-width:100%;padding:16px;box-shadow:0 8px 32px #0000004d,inset 0 1px #ffffff0f}.oI3yBG_phoneQrBox{justify-content:center;margin-bottom:10px;display:flex}.oI3yBG_phoneQr{background:#fff;border-radius:10px;width:168px;height:168px;padding:8px}.oI3yBG_phoneHead{color:var(--dsw-alias-label-primary,#eee);justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px;font-size:14px;font-weight:600;display:flex}.oI3yBG_phoneClose{color:var(--dsw-alias-label-tertiary,#888);cursor:pointer;background:0 0;border:none;padding:4px;font-size:16px;line-height:1}.oI3yBG_phoneClose:hover{color:var(--dsw-alias-label-primary,#eee)}.oI3yBG_phoneHint{color:var(--dsw-alias-label-secondary,#999);margin:0 0 10px;font-size:12px}.oI3yBG_phoneAddrs{flex-direction:column;gap:6px;margin-bottom:12px;display:flex}.oI3yBG_phoneAddr{align-items:center;gap:8px;display:flex}.oI3yBG_phoneAddr code{color:var(--dsw-alias-label-primary,#eee);background:var(--dsw-alias-bg-layer-2,#80808026);text-overflow:ellipsis;white-space:nowrap;border-radius:6px;flex:1;padding:6px 8px;font-size:13px;overflow:hidden}.oI3yBG_phoneCopy{border:1px solid var(--dsw-alias-border-l2,#80808059);background:var(--dsw-alias-bg-layer-2,#80808026);color:var(--dsw-alias-label-primary,#eee);cursor:pointer;border-radius:6px;width:100%;padding:6px 12px;font-size:12px}.oI3yBG_phoneCopy:hover{background:var(--dsw-alias-interactive-bg-hover,#80808033)}";
		const tagId$1 = "@captain1275/dsh-usage-dashboard/usage-entry.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@captain1275/dsh-usage-dashboard";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var usage_entry_module_css_default = {
			"entry": "oI3yBG_entry",
			"entryIcon": "oI3yBG_entryIcon",
			"entryLabel": "oI3yBG_entryLabel",
			"phoneAddr": "oI3yBG_phoneAddr",
			"phoneAddrs": "oI3yBG_phoneAddrs",
			"phoneCard": "oI3yBG_phoneCard",
			"phoneClose": "oI3yBG_phoneClose",
			"phoneCopy": "oI3yBG_phoneCopy",
			"phoneHead": "oI3yBG_phoneHead",
			"phoneHint": "oI3yBG_phoneHint",
			"phoneOverlay": "oI3yBG_phoneOverlay",
			"phoneQr": "oI3yBG_phoneQr",
			"phoneQrBox": "oI3yBG_phoneQrBox"
		};
		//#endregion
		//#region src/client/UsageEntry.tsx
		/**
		* Usage dashboard sidebar entry — DOM-level injection.
		*
		* dsh's sidebar shell exposes no slot an external plugin can register into
		* (`sidebar.workspaces` / `sidebar.settings` are single-occupant and already
		* taken), so — following the task-board / ssh precedent of DOM-level
		* extension — the entry row is injected between the shell's New Session
		* button and the workspace browser. The injection self-heals: a
		* MutationObserver watches the sidebar root and re-inserts the row whenever
		* a React re-render displaces it.
		*
		* The row is plain DOM; clicking it mounts the full-screen dashboard overlay
		* as a separate React root (see mountDashboard).
		* @module @captain1275/dsh-usage-dashboard/client/UsageEntry
		*/
		/** Inline icon (matches the shell's 16px nav-icon look): three rainbow bars. */
		const ICON = "<svg viewBox=\"0 0 16 16\" width=\"14\" height=\"14\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"2.5\" y=\"8\" width=\"3\" height=\"5\" rx=\"0.8\" fill=\"#f472b6\"/><rect x=\"7\" y=\"4.5\" width=\"3\" height=\"8.5\" rx=\"0.8\" fill=\"#fb923c\"/><rect x=\"11.5\" y=\"1.5\" width=\"3\" height=\"11.5\" rx=\"0.8\" fill=\"#4ade80\"/></svg>";
		/** 手机端查看图标（手机 + 信号）。 */
		const PHONE_ICON = "<svg viewBox=\"0 0 16 16\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"4.5\" y=\"1.5\" width=\"7\" height=\"13\" rx=\"1.5\"/><path d=\"M7 12.5h2\"/><path d=\"M9.5 4.2 11 5.7l-1.5 1.5\"/><path d=\"M6.5 7.2 5 5.7l1.5-1.5\"/></svg>";
		/** Find the sidebar shell root element, or undefined while not yet mounted. */
		function sidebarRoot() {
			const column = document.querySelector("[data-pane=\"sidebar\"], [class*=\"sidebarCol\"]");
			if (column === null) return void 0;
			return column.querySelector("[class*=\"logoRow\"]")?.parentElement ?? column.firstElementChild;
		}
		/** The New Session button: nested in the logo row on current shells, a direct child on legacy shells. */
		function newSessionButton(root) {
			const nested = root.querySelector("button[class*=\"newSession\"]");
			if (nested !== null) return nested;
			for (const child of root.children) if (child.tagName === "BUTTON") return child;
		}
		/** The injected dashboard overlay root (single instance while open). */
		let overlayRoot;
		let overlayHost;
		/** Close the dashboard overlay if open. */
		function closeDashboard() {
			overlayRoot?.unmount();
			overlayRoot = void 0;
			overlayHost?.remove();
			overlayHost = void 0;
		}
		/** Open the full-screen dashboard overlay. */
		function openDashboard() {
			if (overlayRoot !== void 0) return;
			overlayHost = document.createElement("div");
			overlayHost.dataset.dshUsageOverlay = "";
			document.body.appendChild(overlayHost);
			overlayRoot = (0, react_dom_client.createRoot)(overlayHost);
			overlayRoot.render(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(DashboardPanel, { onClose: closeDashboard }));
		}
		/** Build the entry row (a detached button; insert once the shell is up). */
		function createEntry() {
			const entry = document.createElement("button");
			entry.type = "button";
			entry.dataset.dshUsageEntry = "";
			entry.className = usage_entry_module_css_default.entry;
			entry.setAttribute("aria-label", t("usage.entry"));
			entry.setAttribute("title", t("usage.entry"));
			entry.innerHTML = `<span class="${usage_entry_module_css_default.entryIcon}">${ICON}</span><span class="${usage_entry_module_css_default.entryLabel}">${t("usage.entry")}</span>`;
			entry.addEventListener("click", () => {
				openDashboard();
			});
			return entry;
		}
		/** 手机端查看入口：点击弹出局域网访问地址。 */
		function createPhoneEntry() {
			const entry = document.createElement("button");
			entry.type = "button";
			entry.dataset.dshPhoneEntry = "";
			entry.className = usage_entry_module_css_default.entry;
			entry.setAttribute("aria-label", "手机端查看");
			entry.setAttribute("title", "手机端查看");
			entry.innerHTML = `<span class="${usage_entry_module_css_default.entryIcon}">${PHONE_ICON}</span><span class="${usage_entry_module_css_default.entryLabel}">手机端查看</span>`;
			entry.addEventListener("click", () => {
				openPhonePanel();
			});
			return entry;
		}
		/** 手机端查看弹窗（单实例）。 */
		let phoneHost;
		let phoneCopyUrl = "";
		/** 关闭手机端查看弹窗。 */
		function closePhonePanel() {
			phoneHost?.remove();
			phoneHost = void 0;
			phoneCopyUrl = "";
		}
		/** 打开手机端查看弹窗：显示局域网访问地址（host /api/usage/lan 提供）。 */
		function openPhonePanel() {
			if (phoneHost !== void 0) return;
			const host = document.createElement("div");
			host.dataset.dshPhoneOverlay = "";
			host.className = usage_entry_module_css_default.phoneOverlay;
			host.innerHTML = `
    <div class="${usage_entry_module_css_default.phoneCard}">
      <div class="${usage_entry_module_css_default.phoneHead}"><span>手机端查看</span><button class="${usage_entry_module_css_default.phoneClose}" aria-label="关闭">×</button></div>
      <div class="${usage_entry_module_css_default.phoneQrBox}"><img class="${usage_entry_module_css_default.phoneQr}" alt="二维码" hidden /></div>
      <p class="${usage_entry_module_css_default.phoneHint}">手机连同一 Wi-Fi，扫码或浏览器打开以下地址：</p>
      <div class="${usage_entry_module_css_default.phoneAddrs}">加载中…</div>
      <button class="${usage_entry_module_css_default.phoneCopy}">复制地址</button>
    </div>`;
			document.body.appendChild(host);
			phoneHost = host;
			host.querySelector(`.${usage_entry_module_css_default.phoneClose}`)?.addEventListener("click", closePhonePanel);
			host.addEventListener("click", (e) => {
				if (e.target === host) closePhonePanel();
			});
			const copyBtn = host.querySelector(`.${usage_entry_module_css_default.phoneCopy}`);
			copyBtn?.addEventListener("click", () => {
				if (phoneCopyUrl === "") return;
				navigator.clipboard?.writeText(phoneCopyUrl).then(() => {
					if (copyBtn !== null) {
						copyBtn.textContent = "已复制";
						window.setTimeout(() => {
							copyBtn.textContent = "复制地址";
						}, 1200);
					}
				}).catch(() => {});
			});
			const addrsBox = host.querySelector(`.${usage_entry_module_css_default.phoneAddrs}`);
			const qrImg = host.querySelector(`.${usage_entry_module_css_default.phoneQr}`);
			fetch("/api/usage/lan").then((r) => r.json()).then((data) => {
				if (addrsBox === null || !host.isConnected) return;
				const d = data;
				if (d?.ok !== true || !Array.isArray(d.addresses)) {
					addrsBox.textContent = "获取局域网地址失败（请重启 dsh 后重试）";
					return;
				}
				const port = location.port !== "" ? `:${location.port}` : "";
				const urls = d.addresses.map((ip) => `http://${ip}${port}`);
				if (urls.length === 0) {
					addrsBox.textContent = "未检测到局域网地址（请检查网络）";
					return;
				}
				phoneCopyUrl = urls[0] ?? "";
				addrsBox.innerHTML = urls.map((u) => `<div class="${usage_entry_module_css_default.phoneAddr}"><code>${u}</code></div>`).join("");
				if (qrImg !== null) try {
					const qr = qrcode(0, "M");
					qr.addData(phoneCopyUrl);
					qr.make();
					const dataUrl = qr.createDataURL(8, 8);
					qrImg.src = dataUrl;
					qrImg.hidden = false;
				} catch {}
			}).catch(() => {
				if (addrsBox !== null && host.isConnected) addrsBox.textContent = "获取局域网地址失败（请重启 dsh 后重试）";
			});
		}
		/** Re-insert the entry after the New Session row (before the browser region). */
		function placeEntry(root, entry) {
			const button = newSessionButton(root);
			if (button === void 0) return false;
			if (entry.parentElement !== root) {
				const row = button.closest("[class*=\"logoRow\"]");
				const base = row !== null && row.parentElement === root ? row : button;
				const family = Array.from(root.children).filter((el) => el instanceof HTMLElement && el.matches("[data-dsh-taskboard-entry], [data-dsh-ssh-entry], [data-dsh-usage-entry], [data-dsh-phone-entry]"));
				const anchor = family.length > 0 ? family[family.length - 1].nextElementSibling : base.nextElementSibling;
				root.insertBefore(entry, anchor);
			}
			return true;
		}
		/** 手机端查看入口：插到用量按钮（data-dsh-usage-entry）正下方。 */
		function placePhone(root, phone) {
			const usage = root.querySelector("[data-dsh-usage-entry]");
			if (usage === null) return false;
			if (phone.parentElement !== root) root.insertBefore(phone, usage.nextElementSibling);
			return true;
		}
		/**
		* Mount the sidebar entries (usage + phone view), waiting for the shell to
		* render and self-healing on later React re-renders.
		* @returns disposer removing the entries and their observers.
		*/
		function mountUsageEntry() {
			const entry = createEntry();
			const phoneEntry = createPhoneEntry();
			let root;
			let placed = false;
			const tryPlace = () => {
				if (root !== void 0 && !root.isConnected) {
					rootObserver.disconnect();
					root = void 0;
					placed = false;
				}
				if (placed) {
					if (document.body.contains(entry) && document.body.contains(phoneEntry)) return;
					rootObserver.disconnect();
					root = void 0;
					placed = false;
				}
				root ??= sidebarRoot();
				if (root === void 0) return;
				const okEntry = placeEntry(root, entry);
				const okPhone = placePhone(root, phoneEntry);
				placed = okEntry && okPhone;
				if (placed) rootObserver.observe(root, {
					childList: true,
					subtree: true
				});
			};
			const waitObserver = new MutationObserver(() => {
				tryPlace();
			});
			waitObserver.observe(document.body, {
				childList: true,
				subtree: true
			});
			const rootObserver = new MutationObserver(() => {
				if (root === void 0 || !root.isConnected) {
					placed = false;
					tryPlace();
					return;
				}
				if (!root.contains(entry) || !root.contains(phoneEntry)) placed = placeEntry(root, entry) && placePhone(root, phoneEntry);
			});
			tryPlace();
			return () => {
				waitObserver.disconnect();
				rootObserver.disconnect();
				entry.remove();
				phoneEntry.remove();
				closeDashboard();
				closePhonePanel();
			};
		}
		//#endregion
		//#region src/client/UsageRecorder.tsx
		/**
		* Usage recorder — an invisible conversation-dock seat that watches the
		* `tokenUsage` projection and uploads per-response snapshots to the host.
		*
		* Semantics:
		*  - The projection is a session-cumulative total that may already be large
		*    when this component mounts (page refresh, session switch, HMR reload).
		*    The FIRST sight only establishes a baseline — never uploaded, so a
		*    mount never counts the whole history as new usage.
		*  - While the total GROWS (a response is streaming), uploads are debounced
		*    to one per second. When growth stops for SETTLE_MS, the recorder
		*    flushes one final snapshot — one completed response = one upload, so
		*    the host's calls counter tracks real response rounds.
		*  - The host stores the LATEST snapshot per session (replace semantics);
		*    repeated uploads overwrite instead of double counting.
		* @module @captain1275/dsh-usage-dashboard/client/UsageRecorder
		*/
		/** 一轮响应结束判定的静默时长（ms）。 */
		const SETTLE_MS = 2e3;
		/** 上报当前快照到宿主（replace 语义：同会话覆盖，不累加）。 */
		async function postSnapshot(snapshot) {
			try {
				await fetch("/api/usage/record", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						...snapshot,
						ts: Date.now()
					})
				});
			} catch {}
		}
		/** 当前模型（由入口从连接层更新，尽力而为）。 */
		let currentModel = "unknown";
		/** 当前会话标题（由入口从连接层更新，尽力而为）。 */
		let currentTitle = "";
		/** 供入口设置当前模型（连接层回调）。 */
		function setCurrentModel(model) {
			if (typeof model === "string" && model.length > 0) currentModel = model;
		}
		/** 供入口设置当前会话标题（连接层回调）。 */
		function setCurrentTitle(title) {
			if (typeof title === "string" && title.length > 0) currentTitle = title;
		}
		/**
		* The invisible recorder seat.
		* @param props - framework runtime share.
		* @returns null (renders nothing).
		*/
		const UsageRecorder = (0, react.memo)(function UsageRecorder(props) {
			const session = props.useSession((s) => ({ sessionId: s.sessionId }));
			const usage = props.useProjection("tokenUsage");
			const lastTotalRef = (0, react.useRef)(-1);
			const settleTimerRef = (0, react.useRef)(null);
			const lastSeenRef = (0, react.useRef)(null);
			const flush = () => {
				settleTimerRef.current = null;
				const seen = lastSeenRef.current;
				if (seen === null) return;
				postSnapshot({
					sessionId: seen.sessionId,
					sessionTitle: seen.title,
					model: currentModel,
					inputTokens: seen.input,
					outputTokens: seen.output,
					cacheReadTokens: seen.cache
				});
			};
			(0, react.useEffect)(() => {
				const sid = session.sessionId;
				if (sid === void 0 || usage === void 0) return;
				const total = usage.uncachedInputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
				const prev = lastTotalRef.current;
				if (prev === -1) {
					lastTotalRef.current = total;
					return;
				}
				lastTotalRef.current = total;
				if (total <= 0) return;
				if (total <= prev) return;
				lastSeenRef.current = {
					sessionId: sid,
					title: currentTitle,
					input: usage.uncachedInputTokens,
					output: usage.outputTokens,
					cache: usage.cacheReadTokens
				};
				if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
				settleTimerRef.current = window.setTimeout(flush, SETTLE_MS);
			}, [session.sessionId, usage]);
			(0, react.useEffect)(() => {
				return () => {
					if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
				};
			}, []);
			return null;
		});
		//#endregion
		//#region \0dsh-css:D:\Desktop\DeepSeek Harness\dsh-web-ui-0.1.10\packages\dsh-usage-dashboard\src\client\usage-settings.module.css.mjs
		const css = ".jgFV7q_card{border:1px solid var(--dsw-alias-border-l2,#8ca0ff38);background:var(--dsw-alias-surface-card,#12182e99);border-radius:10px;list-style:none;overflow:hidden}.jgFV7q_header{width:100%;color:inherit;font:inherit;cursor:pointer;text-align:left;background:0 0;border:none;align-items:center;gap:10px;padding:12px 16px;display:flex}.jgFV7q_headText{flex-direction:column;flex:1;gap:2px;min-width:0;display:flex}.jgFV7q_name{color:var(--dsw-alias-label-primary,#eef1ff);font-size:14px;font-weight:600}.jgFV7q_description{color:var(--dsw-alias-label-tertiary,#8b95c4);font-size:12px}.jgFV7q_chevron{color:var(--dsw-alias-label-tertiary,#8b95c4);font-size:12px;transition:transform .12s}.jgFV7q_chevronOpen{color:var(--dsw-alias-label-tertiary,#8b95c4);font-size:12px;transform:rotate(180deg)}.jgFV7q_body{flex-direction:column;gap:8px;padding:4px 16px 14px;display:flex}.jgFV7q_legendRow{color:var(--dsw-alias-label-secondary,#b9c2e8);align-items:center;gap:8px;font-size:12px;display:flex}.jgFV7q_dot{border-radius:50%;flex:none;width:9px;height:9px}";
		const tagId = "@captain1275/dsh-usage-dashboard/usage-settings.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@captain1275/dsh-usage-dashboard";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var usage_settings_module_css_default = {
			"body": "jgFV7q_body",
			"card": "jgFV7q_card",
			"chevron": "jgFV7q_chevron",
			"chevronOpen": "jgFV7q_chevronOpen",
			"description": "jgFV7q_description",
			"dot": "jgFV7q_dot",
			"headText": "jgFV7q_headText",
			"header": "jgFV7q_header",
			"legendRow": "jgFV7q_legendRow",
			"name": "jgFV7q_name"
		};
		//#endregion
		//#region src/client/UsageSettingsCard.tsx
		/**
		* Usage dashboard settings card — a simple informational card for the
		* Web UI plugin group: explains what the dashboard records and where the
		* data lives. No configuration fields (the dashboard is zero-config).
		* @module @captain1275/dsh-usage-dashboard/client/UsageSettingsCard
		*/
		/**
		* Render the informational settings card.
		* @returns the card element.
		*/
		function UsageSettingsCard(_props) {
			const [open, setOpen] = (0, react.useState)(false);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: usage_settings_module_css_default.card,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: usage_settings_module_css_default.header,
					"aria-expanded": open,
					"aria-label": `${open ? "收起" : "展开"}: ${t("usage.settingsTitle")}`,
					onClick: () => {
						setOpen(!open);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: usage_settings_module_css_default.headText,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_settings_module_css_default.name,
							children: t("usage.settingsTitle")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_settings_module_css_default.description,
							children: t("usage.settingsHint")
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: open ? usage_settings_module_css_default.chevronOpen : usage_settings_module_css_default.chevron,
						children: "▾"
					})]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: usage_settings_module_css_default.body,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: usage_settings_module_css_default.legendRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_settings_module_css_default.dot,
								style: { background: "#f472b6" }
							}), " 每次响应的 token 用量自动记录"]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: usage_settings_module_css_default.legendRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_settings_module_css_default.dot,
								style: { background: "#fb923c" }
							}), " 侧边栏彩色图表按钮打开看板"]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: usage_settings_module_css_default.legendRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_settings_module_css_default.dot,
								style: { background: "#4ade80" }
							}), " 数据保存在 ~/.dsh/usage.json（本机）"]
						})
					]
				}) : null]
			});
		}
		//#endregion
		//#region src/client/index.ts
		/** Services required. */
		const inject = [
			"slots",
			"locale",
			"connection",
			"settingsScope"
		];
		/**
		* Register the usage dashboard surface.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "usage-dashboard: dictionaries");
			let disposeEntry;
			ctx.effect(() => {
				disposeEntry = mountUsageEntry();
				return () => disposeEntry?.();
			}, "usage-dashboard: sidebar entry");
			ctx.effect(() => {
				const connection = ctx.get("connection");
				if (connection?.api?.sessions === void 0) return () => {};
				let cancelled = false;
				const tick = async () => {
					try {
						const item = (await connection.api?.sessions?.list({ cursor: "" }))?.result?.value?.items?.[0];
						const sessionId = item?.sessionId;
						if (item?.title !== void 0 && !cancelled) setCurrentTitle(item.title);
						if (sessionId === void 0 || cancelled) return;
						const model = (await connection.api?.sessions?.models({ sessionId }))?.result?.value?.current?.model;
						if (model !== void 0 && !cancelled) setCurrentModel(model);
					} catch {}
				};
				tick();
				const timer = window.setInterval(() => {
					tick();
				}, 5e3);
				return () => {
					cancelled = true;
					window.clearInterval(timer);
				};
			}, "usage-dashboard: model subscription");
			ctx.slots.inject("conversation.composer.dock", () => ctx.slots.register({
				name: "conversation.composer.dock",
				id: "usage-recorder",
				order: 5
			}, UsageRecorder));
			ctx.slots.inject("web-ui.plugin.item", () => ctx.slots.register({
				name: "web-ui.plugin.item",
				id: "usage-dashboard",
				order: 130,
				locale: NS
			}, UsageSettingsCard));
		}
		//#endregion
		exports.apply = apply;
		exports.closeDashboard = closeDashboard;
		exports.inject = inject;
		exports.mountUsageEntry = mountUsageEntry;
		exports.openDashboard = openDashboard;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map