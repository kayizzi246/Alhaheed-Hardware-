// Automatic FlutterFlow imports
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/custom_code/widgets/index.dart'; // Imports other custom widgets
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart' hide RepeatMode;
// Begin custom widget code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!

// ╔═══════════════════════════════════════════════════════════════╗
// ║  NAME THIS CUSTOM WIDGET:   AlHadeedShop                      ║
// ╚═══════════════════════════════════════════════════════════════╝
//
// FlutterFlow looks for a class with exactly the name typed in the
// "Custom Widget" box. The default is "NewCustomWidget", and leaving
// it there is what produces:
//
//     No widget "NewCustomWidget" found.
//
// So set the name field to:
//
//     AlHadeedShop
//
// Spelling and capitals both matter. Then switch on "Width and Height
// (required)" — this widget already accepts them — and Save.
//
// The shelf: every product, searchable, tap one to add it.


// The shared core below is identical in all five screen files, so each
// file carries a few helpers it does not use itself. That is an analyzer
// warning, not an error, and silencing it keeps real warnings visible.
// ignore_for_file: unused_element

import 'dart:convert';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart'
    show kIsWeb, defaultTargetPlatform, TargetPlatform;
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

// ═══════════════════════════════════════════════════════════════
//  WHERE THE API LIVES
//
//  The one line to change when you deploy. Must match the value in
//  al_hadeed_cart.dart, al_hadeed_orders.dart,
//  al_hadeed_company.dart and al_hadeed_manager.dart.
//
//  On a real phone `localhost` means the phone itself, so while testing
//  use the computer's LAN address: http://192.168.1.14:4000
// ═══════════════════════════════════════════════════════════════
const String _apiBase = 'https://pearlfx.online';

// Everything from here down to the screen itself is repeated, identically,
// in all five screen files. That is deliberate: FlutterFlow generates
// `custom_code/widgets/index.dart` as a list of
// `export 'al_hadeed_shop.dart' show AlHadeedShop;` lines, so a widget
// class is the only thing that crosses from one custom widget file to
// another. A shared helper is simply not visible, and the build fails
// with "The function '_txt' isn't defined".

// ═══════════════════════════════════════════════════════════════
//  TOKENS — identical in shop, cart, orders, company and manager.
// ═══════════════════════════════════════════════════════════════
const Color _white = Color(0xFFFFFFFF);
const Color _bg = Color(0xFFF4F6F8);
const Color _ink = Color(0xFF102A3F);
const Color _inkSoft = Color(0xFF33475B);
const Color _mid = Color(0xFF6B7A88);
const Color _light = Color(0xFFA3AFB9);
const Color _hairline = Color(0xFFE3E8ED);
const Color _tile = Color(0xFFF7F8FA);
const Color _navy = Color(0xFF14334F);
const Color _navyDark = Color(0xFF0D2439);
const Color _brand = Color(0xFFE98A24);
const Color _brandDark = Color(0xFFC9731A);
const Color _brandPale = Color(0xFFFDF2E4);
const Color _green = Color(0xFF1E8E5A);
const Color _greenPale = Color(0xFFE8F5EE);
const Color _blue = Color(0xFF2D6CA2);
const Color _bluePale = Color(0xFFE8F0F8);
const Color _ember = Color(0xFFC0392B);
const Color _emberPale = Color(0xFFFBECEA);

const Cubic _ease = Cubic(0.23, 1, 0.32, 1);

double _ui = 1.0;

bool get _isApple =>
    !kIsWeb &&
    (defaultTargetPlatform == TargetPlatform.iOS ||
        defaultTargetPlatform == TargetPlatform.macOS);

double _trackingFor(double s) {
  if (s >= 24) return -0.025;
  if (s >= 20) return -0.020;
  if (s >= 17) return -0.013;
  if (s >= 15) return -0.007;
  if (s >= 13) return 0.0;
  return 0.008;
}

TextStyle _font(
  double size, {
  FontWeight weight = FontWeight.w400,
  Color color = _inkSoft,
  double height = 1.3,
}) {
  final s = size * _ui;
  return TextStyle(
    fontFamily: _isApple ? (s >= 20 ? '.SF Pro Display' : '.SF Pro Text') : null,
    fontFamilyFallback: _isApple
        ? const ['.SF UI Display', '.SF UI Text', 'Helvetica Neue']
        : null,
    fontSize: s,
    fontWeight: weight,
    color: color,
    height: height,
    letterSpacing: s * _trackingFor(s),
  );
}

TextStyle _title(double size,
        {FontWeight weight = FontWeight.w700, Color color = _ink}) =>
    _font(size, weight: weight, color: color, height: 1.15);

TextStyle _txt(double size,
        {FontWeight weight = FontWeight.w400,
        Color color = _inkSoft,
        double height = 1.3}) =>
    _font(size, weight: weight, color: color, height: height);

BoxDecoration _liquid({
  Color? tint,
  bool onDark = false,
  double radius = 999,
  bool circle = false,
}) {
  final List<Color> fill;
  final Color rim;
  if (tint != null) {
    fill = [Color.lerp(tint, _white, 0.20)!, tint];
    rim = _white.withOpacity(0.40);
  } else if (onDark) {
    fill = [_white.withOpacity(0.30), _white.withOpacity(0.12)];
    rim = _white.withOpacity(0.42);
  } else {
    fill = const [_white, Color(0xFFEFF2F5)];
    rim = _ink.withOpacity(0.10);
  }
  return BoxDecoration(
    gradient: LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: fill,
    ),
    shape: circle ? BoxShape.circle : BoxShape.rectangle,
    borderRadius: circle ? null : BorderRadius.circular(radius),
    border: Border.all(color: rim, width: 1),
  );
}

class _GradientRim extends BoxBorder {
  const _GradientRim(this.gradient, {this.width = 1});

  final Gradient gradient;
  final double width;

  @override
  BorderSide get top => BorderSide.none;
  @override
  BorderSide get bottom => BorderSide.none;
  @override
  EdgeInsetsGeometry get dimensions => EdgeInsets.all(width);
  @override
  bool get isUniform => true;

  @override
  void paint(
    Canvas canvas,
    Rect rect, {
    ui.TextDirection? textDirection,
    BoxShape shape = BoxShape.rectangle,
    BorderRadius? borderRadius,
  }) {
    final paint = Paint()
      ..strokeWidth = width
      ..shader = gradient.createShader(rect)
      ..style = PaintingStyle.stroke;
    final inner = rect.deflate(width / 2);
    if (borderRadius != null) {
      canvas.drawRRect(borderRadius.toRRect(inner), paint);
    } else {
      canvas.drawRect(inner, paint);
    }
  }

  @override
  ShapeBorder scale(double t) => _GradientRim(gradient, width: width * t);
}

class _Glass extends StatelessWidget {
  const _Glass({
    required this.child,
    this.height,
    this.radius = 22,
    this.blur = 24,
    this.padding,
  });

  final Widget child;
  final double? height;
  final double radius;
  final double blur;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(sigmaX: blur, sigmaY: blur),
          child: Container(
            height: height,
            padding: padding,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(radius),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [_white.withOpacity(0.86), _white.withOpacity(0.66)],
              ),
              border: _GradientRim(
                LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [_white.withOpacity(0.95), _ink.withOpacity(0.12)],
                ),
              ),
            ),
            child: child,
          ),
        ),
      );
}

class _Pressable extends StatefulWidget {
  const _Pressable({required this.child, this.onTap, this.scale = 0.96});

  final Widget child;
  final VoidCallback? onTap;
  final double scale;

  @override
  State<_Pressable> createState() => _PressableState();
}

class _PressableState extends State<_Pressable> {
  bool _down = false;

  void _set(bool v) {
    if (_down != v && mounted) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) => GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => _set(true),
        onTapUp: (_) => _set(false),
        onTapCancel: () => _set(false),
        onTap: widget.onTap == null
            ? null
            : () {
                HapticFeedback.lightImpact();
                widget.onTap!();
              },
        child: AnimatedScale(
          scale: _down ? widget.scale : 1.0,
          duration: Duration(milliseconds: _down ? 100 : 160),
          curve: _ease,
          child: widget.child,
        ),
      );
}

class _Skeleton extends StatefulWidget {
  const _Skeleton(this.width, this.height, {this.radius = 12});

  final double width;
  final double height;
  final double radius;

  @override
  State<_Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<_Skeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        builder: (_, __) => Container(
          width: widget.width == 0 ? null : widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            color: Color.lerp(_tile, _hairline, _c.value),
            borderRadius: BorderRadius.circular(widget.radius),
          ),
        ),
      );
}

/// A text field styled to match the tiles, with no Material underline
/// or outline fighting the flat look.
class _Field extends StatelessWidget {
  const _Field({
    required this.controller,
    required this.hint,
    this.validator,
    this.keyboardType,
    this.maxLines = 1,
    this.maxLength,
    this.autofocus = false,
    this.onChanged,
    this.capitalisation = TextCapitalization.none,
  });

  final TextEditingController controller;
  final String hint;
  final String? Function(String?)? validator;
  final TextInputType? keyboardType;
  final int maxLines;
  final int? maxLength;
  final bool autofocus;
  final ValueChanged<String>? onChanged;
  final TextCapitalization capitalisation;

  @override
  Widget build(BuildContext context) => TextFormField(
        controller: controller,
        validator: validator,
        keyboardType: keyboardType,
        maxLines: maxLines,
        maxLength: maxLength,
        autofocus: autofocus,
        onChanged: onChanged,
        textCapitalization: capitalisation,
        cursorColor: _brand,
        style: _txt(15, color: _ink),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: _txt(15, color: _light),
          counterText: '',
          filled: true,
          fillColor: _tile,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: _hairline),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: _hairline),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: _brand, width: 1.5),
          ),
          errorStyle: _txt(12, color: _ember),
        ),
      );
}

// ═══════════════════════════════════════════════════════════════
//  THE API
// ═══════════════════════════════════════════════════════════════

class _ApiError implements Exception {
  _ApiError(this.message, {this.unauthorised = false});
  final String message;
  final bool unauthorised;
  @override
  String toString() => message;
}

/// The API answers `{ ...data }` or `{ "error": "in plain words" }`, so a
/// failure arrives with the wording the server wrote — including the
/// spending-limit and out-of-stock messages, which explain themselves far
/// better than a status code would.
Map<String, dynamic> _unwrap(http.Response res) {
  Map<String, dynamic> body;
  try {
    body = jsonDecode(res.body) as Map<String, dynamic>;
  } catch (_) {
    throw _ApiError('The server sent something unexpected. Try again.');
  }

  final error = body['error'];
  if (error != null) {
    throw _ApiError(
      error is String ? error : 'Something went wrong.',
      unauthorised: res.statusCode == 401,
    );
  }
  return body;
}

Map<String, String> _headers({bool json = false}) => {
      'Accept': 'application/json',
      if (json) 'Content-Type': 'application/json',
      if (_Session().token != null)
        'Authorization': 'Bearer ${_Session().token}',
    };

Future<Map<String, dynamic>> _apiGet(String path) async {
  try {
    final res = await http
        .get(Uri.parse(_apiBase).resolve(path), headers: _headers())
        .timeout(const Duration(seconds: 20));
    return _unwrap(res);
  } on _ApiError {
    rethrow;
  } catch (_) {
    throw _ApiError("Can't reach the shop. Check your connection.");
  }
}

Future<Map<String, dynamic>> _apiSend(
    String method, String path, Object body) async {
  try {
    final uri = Uri.parse(_apiBase).resolve(path);
    final headers = _headers(json: true);
    final payload = jsonEncode(body);
    final res = await switch (method) {
      'PATCH' => http.patch(uri, headers: headers, body: payload),
      'DELETE' => http.delete(uri, headers: headers, body: payload),
      _ => http.post(uri, headers: headers, body: payload),
    }
        .timeout(const Duration(seconds: 20));
    return _unwrap(res);
  } on _ApiError {
    rethrow;
  } catch (_) {
    throw _ApiError("Can't reach the shop. Check your connection.");
  }
}

Future<Map<String, dynamic>> _apiPost(String path, Object body) =>
    _apiSend('POST', path, body);

// ═══════════════════════════════════════════════════════════════
//  MONEY
// ═══════════════════════════════════════════════════════════════

String _ugx(int amount) =>
    'UGX ${amount.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}';

String _shortUgx(int amount) {
  if (amount >= 1000000) {
    final m = amount / 1000000;
    final t = m >= 100 || m == m.roundToDouble()
        ? m.round().toString()
        : m.toStringAsFixed(1);
    return 'UGX ${t}M';
  }
  if (amount >= 1000) return 'UGX ${(amount / 1000).round()}K';
  return 'UGX $amount';
}

/// "09:26" from the API's "2026-11-19 09:26:41".
String _shortTime(String? stamp) {
  if (stamp == null || stamp.length < 16) return '';
  return stamp.substring(11, 16);
}

/// "19 Nov, 09:26" — enough to tell two orders apart without the year
/// taking up half the row.
String _when(String? stamp) {
  if (stamp == null || stamp.length < 16) return '';
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  final month = int.tryParse(stamp.substring(5, 7)) ?? 1;
  final day = stamp.substring(8, 10);
  return '${int.parse(day)} ${months[month - 1]}, ${stamp.substring(11, 16)}';
}

// ═══════════════════════════════════════════════════════════════
//  WHO IS SIGNED IN
// ═══════════════════════════════════════════════════════════════

/// The signed-in customer, kept on the phone so the app opens straight
/// into the shop rather than asking for a code every time.
class _Session extends ChangeNotifier {
  factory _Session() => _instance;
  _Session._();
  static final _Session _instance = _Session._();

  static const _kToken = 'alhadeed.token';
  static const _kUser = 'alhadeed.user';

  SharedPreferences? _prefs;
  String? token;
  Map<String, dynamic>? user;

  Future<void> load() async {
    _prefs = await SharedPreferences.getInstance();
    token = _prefs!.getString(_kToken);
    final raw = _prefs!.getString(_kUser);
    if (raw != null) {
      try {
        user = jsonDecode(raw) as Map<String, dynamic>;
      } catch (_) {
        user = null;
      }
    }
    notifyListeners();
  }

  bool get signedIn => token != null && user != null;
  String get fullName => user?['fullName'] as String? ?? '';
  String get phone => user?['phone'] as String? ?? '';
  String get accountType => user?['accountType'] as String? ?? 'individual';
  bool get isCompany => accountType != 'individual';
  bool get isCompanyOwner => accountType == 'company_owner';
  String? get staffRole => user?['staffRole'] as String?;
  int? get spendingLimit => (user?['spendingLimit'] as num?)?.toInt();
  // The sign-in response carries companyId but not the company's name, so
  // the name is fetched from /auth/me right after signing in and kept
  // alongside it. Both shapes are read here so an older stored session
  // still shows something sensible.
  String get companyName =>
      user?['companyName'] as String? ??
      (user?['company'] as Map<String, dynamic>?)?['company_name']
          as String? ??
      'Company account';

  /// The line under the logo. A company's buyer can see at a glance
  /// whose account an order will land on.
  String get subtitle {
    if (!signedIn) return 'Browse and order — no account needed';
    if (!isCompany) return fullName;
    if (isCompanyOwner) return '$companyName · Owner view';
    return '$companyName · ordering as $fullName'
        '${staffRole == null ? '' : ' ($staffRole)'}';
  }

  Future<void> save(String newToken, Map<String, dynamic> newUser) async {
    _prefs ??= await SharedPreferences.getInstance();
    token = newToken;
    user = newUser;
    await _prefs!.setString(_kToken, newToken);
    await _prefs!.setString(_kUser, jsonEncode(newUser));
    notifyListeners();
  }

  Future<void> signOut() async {
    _prefs ??= await SharedPreferences.getInstance();
    token = null;
    user = null;
    await _prefs!.remove(_kToken);
    await _prefs!.remove(_kUser);
    notifyListeners();
  }
}

// ═══════════════════════════════════════════════════════════════
//  THE CART
// ═══════════════════════════════════════════════════════════════

/// Kept on the phone, not on the server: a cart is a private scribble
/// until it is submitted, and losing it to a dropped connection on the
/// way to the shop would be its own small disaster.
class _CartStore extends ChangeNotifier {
  factory _CartStore() => _instance;
  _CartStore._();
  static final _CartStore _instance = _CartStore._();

  static const _key = 'alhadeed.cart';
  SharedPreferences? _prefs;
  List<Map<String, dynamic>> lines = [];

  Future<void> load() async {
    _prefs = await SharedPreferences.getInstance();
    final raw = _prefs!.getString(_key);
    if (raw != null) {
      try {
        lines = (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
      } catch (_) {
        lines = [];
      }
    }
    notifyListeners();
  }

  Future<void> _save() async {
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs!.setString(_key, jsonEncode(lines));
    notifyListeners();
  }

  int get count => lines.fold(0, (n, l) => n + (l['quantity'] as int));

  int get subtotal =>
      lines.fold(0, (n, l) => n + (l['price'] as int) * (l['quantity'] as int));

  int quantityOf(int productId) {
    for (final l in lines) {
      if (l['productId'] == productId) return l['quantity'] as int;
    }
    return 0;
  }

  Future<void> add(Map<String, dynamic> product, int quantity) async {
    final id = (product['id'] as num).toInt();
    final existing = lines.indexWhere((l) => l['productId'] == id);
    if (existing >= 0) {
      lines[existing]['quantity'] =
          (lines[existing]['quantity'] as int) + quantity;
    } else {
      lines.add({
        'productId': id,
        'name': product['name'],
        'unit': product['unit'],
        'code': product['code'],
        'category': product['category_name'],
        'price': (product['price'] as num).toInt(),
        'quantity': quantity,
      });
    }
    await _save();
  }

  Future<void> setQuantity(int productId, int quantity) async {
    final i = lines.indexWhere((l) => l['productId'] == productId);
    if (i < 0) return;
    if (quantity <= 0) {
      lines.removeAt(i);
    } else {
      lines[i]['quantity'] = quantity;
    }
    await _save();
  }

  Future<void> clear() async {
    lines = [];
    await _save();
  }
}

// ═══════════════════════════════════════════════════════════════
//  SHARED PIECES
// ═══════════════════════════════════════════════════════════════

/// A colour per category, so cement is always grey-blue and paint is
/// always violet. Hashed from the name rather than hard-coded, because
/// the Manager can add a category on the web panel at any time.
Color _categoryColour(String? name) {
  const palette = [
    Color(0xFF4A6E8A),
    Color(0xFF8A5A3C),
    Color(0xFF3F7F6B),
    Color(0xFF8A6FAE),
    Color(0xFF2F6E9E),
    Color(0xFFB07A2A),
    Color(0xFF5B6E7F),
  ];
  if (name == null || name.isEmpty) return palette[0];
  var h = 0;
  for (final c in name.codeUnits) {
    h = (h * 31 + c) & 0x7FFFFFFF;
  }
  return palette[h % palette.length];
}

/// One colour pair per status, used on every screen, so a chip means the
/// same thing wherever it turns up.
(Color, Color) _statusColours(String status) => switch (status) {
      'pending_payment' => (_brandPale, _brandDark),
      'paid' => (_bluePale, _blue),
      'payment_verified' => (_bluePale, _blue),
      'packed' => (_bluePale, _blue),
      'released' => (_greenPale, _green),
      'cancelled' => (_emberPale, _ember),
      'rejected' => (_emberPale, _ember),
      _ => (_tile, _mid),
    };

String _statusLabel(String status) => switch (status) {
      'pending_payment' => 'Pending payment',
      'paid' => 'Paid',
      'payment_verified' => 'Verifying',
      'packed' => 'Being packed',
      'released' => 'Completed',
      'cancelled' => 'Cancelled',
      'rejected' => 'Payment rejected',
      _ => status,
    };

/// The small square on the product sheet, when there is no photograph
/// to put there: the category's colour and the first letter of its name.
Widget _initialTile(Map<String, dynamic> product, Color colour) => ColoredBox(
      color: colour,
      child: Center(
        child: Text(
          (product['category_name'] as String? ?? '?')
              .characters
              .first
              .toUpperCase(),
          style: _title(24, weight: FontWeight.w800, color: _white),
        ),
      ),
    );

/// The photograph of a product, where there is one.
///
/// A shop that has not photographed its stock yet still gets a tidy
/// shelf: the fallback is the category's colour with its name on it,
/// which is what every tile looked like before any pictures existed.
///
/// That fallback is also the error state. On a dropped connection the
/// default is Flutter's broken-image glyph — a grey icon that says
/// "something is wrong with this app" when the truth is that the line
/// went away for a second. The coloured tile says nothing is wrong,
/// which is nearer the truth and much easier to look at on a wall of
/// twenty products.
class _ProductPicture extends StatelessWidget {
  const _ProductPicture({required this.product, required this.colour});

  final Map<String, dynamic> product;
  final Color colour;

  @override
  Widget build(BuildContext context) {
    final url = product['picture'] as String?;

    if (url == null || url.isEmpty) return _fallback();

    return Image.network(
      url,
      fit: BoxFit.cover,
      // The shelf is a grid of twenty; full-resolution decodes of all
      // of them is how a mid-range Android runs out of memory.
      cacheWidth: 420,
      errorBuilder: (_, __, ___) => _fallback(),
      loadingBuilder: (_, child, progress) =>
          progress == null ? child : _fallback(dim: true),
    );
  }

  Widget _fallback({bool dim = false}) => DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color.lerp(colour, _white, dim ? 0.3 : 0.12)!,
              Color.lerp(colour, Colors.black, dim ? 0.0 : 0.12)!,
            ],
          ),
        ),
        child: dim
            ? null
            : Center(
                child: Padding(
                  padding: const EdgeInsets.all(10),
                  child: Text(
                    (product['category_name'] as String? ?? 'ITEM')
                        .toUpperCase(),
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style:
                        _title(12.5, weight: FontWeight.w800, color: _white),
                  ),
                ),
              ),
      );
}

class _Chip extends StatelessWidget {
  const _Chip(this.label,
      {required this.bg, required this.fg, this.bold = true});

  final String label;
  final Color bg;
  final Color fg;
  final bool bold;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          label,
          style: _txt(11.5,
              weight: bold ? FontWeight.w700 : FontWeight.w500, color: fg),
        ),
      );
}

/// The bottom bar. Four screens, and everything else the app does is a
/// sheet that slides over whichever one you are on — so you never lose
/// your place to look something up.
///
/// The other three screens are reached by their widget class, which is
/// the only thing FlutterFlow lets cross between custom widget files.
class _BottomBar extends StatelessWidget {
  const _BottomBar({required this.current});

  /// 'shop' | 'cart' | 'orders' | 'company'
  final String current;

  void _go(BuildContext context, Widget page) =>
      Navigator.of(context).pushReplacement(PageRouteBuilder(
        pageBuilder: (_, __, ___) => page,
        transitionDuration: Duration.zero,
        reverseTransitionDuration: Duration.zero,
      ));

  @override
  Widget build(BuildContext context) {
    final owner = _Session().isCompanyOwner;
    final items = <(String, String, IconData, Widget)>[
      ('shop', 'Shop', Icons.storefront_outlined, const AlHadeedShop()),
      ('cart', 'Cart', Icons.shopping_cart_outlined, const AlHadeedCart()),
      ('orders', 'Orders', Icons.receipt_long_outlined, const AlHadeedOrders()),
      (
        'company',
        owner ? 'Company' : 'Account',
        owner ? Icons.business_outlined : Icons.person_outline_rounded,
        const AlHadeedCompany()
      ),
    ];

    return Container(
      decoration: const BoxDecoration(
        color: _white,
        border: Border(top: BorderSide(color: _hairline)),
      ),
      padding: EdgeInsets.only(
          top: 8, bottom: MediaQuery.paddingOf(context).bottom + 8),
      child: Row(
        children: [
          for (final (key, label, icon, page) in items)
            Expanded(
              child: _Pressable(
                scale: 0.92,
                onTap: key == current ? null : () => _go(context, page),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Icon(icon,
                            size: 22, color: key == current ? _brand : _light),
                        if (key == 'cart')
                          ListenableBuilder(
                            listenable: _CartStore(),
                            builder: (_, __) {
                              final n = _CartStore().count;
                              if (n == 0) return const SizedBox.shrink();
                              return Positioned(
                                right: -8,
                                top: -5,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 5, vertical: 1),
                                  decoration: BoxDecoration(
                                    color: _brand,
                                    borderRadius: BorderRadius.circular(9),
                                  ),
                                  constraints:
                                      const BoxConstraints(minWidth: 17),
                                  child: Text('$n',
                                      textAlign: TextAlign.center,
                                      style: _txt(10.5,
                                          weight: FontWeight.w700,
                                          color: _white)),
                                ),
                              );
                            },
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(label,
                        style: _txt(10.5,
                            weight: key == current
                                ? FontWeight.w700
                                : FontWeight.w500,
                            color: key == current ? _brand : _light)),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// The navy header every screen wears.
class _Header extends StatelessWidget {
  const _Header({required this.subtitle, this.trailing});

  final String subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: EdgeInsets.fromLTRB(
            18, MediaQuery.paddingOf(context).top + 12, 12, 14),
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [_navy, _navyDark],
          ),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text('AL HADEED ',
                          style: _title(16.5,
                              weight: FontWeight.w800, color: _white)),
                      Text('HARDWARE',
                          style: _title(16.5,
                              weight: FontWeight.w800, color: _brand)),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: _txt(12, color: _white.withOpacity(0.75))),
                ],
              ),
            ),
            if (trailing != null) trailing!,
          ],
        ),
      );
}

/// Every screen's "nothing here yet" and "that did not work" state.
class _Empty extends StatelessWidget {
  const _Empty({
    required this.icon,
    required this.title,
    required this.line,
    this.action,
    this.onAction,
    this.tone = _mid,
  });

  final IconData icon;
  final String title;
  final String line;
  final String? action;
  final VoidCallback? onAction;
  final Color tone;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 76,
                height: 76,
                decoration: BoxDecoration(
                    color: tone == _ember ? _emberPale : _tile,
                    shape: BoxShape.circle),
                child: Icon(icon, size: 32, color: tone),
              ),
              const SizedBox(height: 16),
              Text(title, textAlign: TextAlign.center, style: _title(19)),
              const SizedBox(height: 8),
              Text(line,
                  textAlign: TextAlign.center,
                  style: _txt(13.5, color: _mid, height: 1.5)),
              if (action != null) ...[
                const SizedBox(height: 20),
                _Pressable(
                  scale: 0.98,
                  onTap: onAction,
                  child: Container(
                    height: 46,
                    padding: const EdgeInsets.symmetric(horizontal: 22),
                    alignment: Alignment.center,
                    decoration: _liquid(tint: _brand, radius: 23),
                    child: Text(action!,
                        style:
                            _txt(15, weight: FontWeight.w600, color: _white)),
                  ),
                ),
              ],
            ],
          ),
        ),
      );
}

/// The shell every sheet in the app sits in: grab handle, rounded top,
/// lifted clear of the keyboard.
class _Sheet extends StatelessWidget {
  const _Sheet({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    _ui = (mq.size.width / 390).clamp(0.86, 1.08);
    return Padding(
      // Lifts the sheet above the keyboard, or the submit button sits
      // under it and cannot be reached.
      padding: EdgeInsets.only(bottom: mq.viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: _white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
        ),
        clipBehavior: Clip.antiAlias,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(top: 10, bottom: 8),
                decoration: BoxDecoration(
                  color: _hairline,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              child,
            ],
          ),
        ),
      ),
    );
  }
}

void _toast(BuildContext context, String message, {bool bad = false}) =>
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        backgroundColor: bad ? _ember : _ink,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        content: Text(message, style: _txt(13.5, color: _white)),
      ),
    );

// ═══════════════════════════════════════════════════════════════
//  SCREEN 1 OF 4 — THE SHOP
// ═══════════════════════════════════════════════════════════════

/// The product list: search, filter by category, add to cart.
///
/// This is the app's front door. If nobody is signed in yet the sign-in
/// sheet comes up over it rather than on a separate page — there is no
/// second screen to build or navigate back from, and the catalogue is
/// already behind it when you finish.
class AlHadeedShop extends StatefulWidget {
  const AlHadeedShop({super.key, this.width, this.height});

  /// FlutterFlow fills these in from the canvas when "Width and Height"
  /// is switched on. They are not something to wire up, but the
  /// constructor has to accept them or saving fails with:
  /// Parameter "width" not found.
  final double? width;
  final double? height;

  @override
  State<AlHadeedShop> createState() => _AlHadeedShopState();
}

class _AlHadeedShopState extends State<AlHadeedShop> {
  final _search = TextEditingController();

  List<Map<String, dynamic>> _products = [];
  List<Map<String, dynamic>> _categories = [];
  int? _categoryId;
  String _query = '';
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _boot();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _boot() async {
    await _Session().load();
    await _CartStore().load();
    if (!mounted) return;
    // Nobody is asked who they are to look at a shelf. The catalogue is
    // public, so it loads whether or not anyone has signed in; the phone
    // number is wanted at the point of ordering and not before.
    await _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final products = await _apiGet('/api/products');
      final cats = await _apiGet('/api/products/categories');
      if (!mounted) return;
      setState(() {
        _products = (products['products'] as List).cast<Map<String, dynamic>>();
        _categories = (cats['categories'] as List).cast<Map<String, dynamic>>();
        _loading = false;
      });
    } on _ApiError catch (e) {
      if (!mounted) return;
      if (e.unauthorised) {
        // A token that expired while the app was closed. Drop it and
        // carry on browsing: the catalogue needs no account anyway.
        await _Session().signOut();
        if (!mounted) return;
        await _load();
        return;
      }
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  List<Map<String, dynamic>> get _shown {
    final q = _query.trim().toLowerCase();
    return _products.where((p) {
      if (_categoryId != null && p['category_id'] != _categoryId) return false;
      if (q.isEmpty) return true;
      final name = (p['name'] as String? ?? '').toLowerCase();
      final code = (p['code'] as String? ?? '').toLowerCase();
      final cat = (p['category_name'] as String? ?? '').toLowerCase();
      return name.contains(q) || code.contains(q) || cat.contains(q);
    }).toList(growable: false);
  }

  /// Signing in is optional here — it is for seeing past orders, or for
  /// a company's staff ordering against the company account. A first-time
  /// customer never has to open it: the checkout takes their number.
  Future<void> _openSignIn() => showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        backgroundColor: Colors.transparent,
        builder: (_) => const _SignInSheet(),
      ).then((_) {
        if (mounted) setState(() {});
      });

  Future<void> _openProduct(Map<String, dynamic> product) =>
      showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        backgroundColor: Colors.transparent,
        builder: (_) => _ProductSheet(product: product),
      ).then((_) {
        if (mounted) setState(() {});
      });

  Future<void> _openProfile() => showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        backgroundColor: Colors.transparent,
        builder: (_) => const _ProfileSheet(),
      ).then((_) {
        // Signing out leaves the catalogue where it is. There is nothing
        // to hide behind an account.
        if (mounted) setState(() {});
      });

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    _ui = (mq.size.width / 390).clamp(0.86, 1.08);

    return MediaQuery(
      data: mq.copyWith(
        textScaler:
            mq.textScaler.clamp(minScaleFactor: 0.9, maxScaleFactor: 1.2),
      ),
      child: AnnotatedRegion<SystemUiOverlayStyle>(
        // The header runs under the status bar, so the clock and battery
        // need to be light over it.
        value: SystemUiOverlayStyle.light
            .copyWith(statusBarColor: Colors.transparent),
        child: Container(
          width: widget.width ?? mq.size.width,
          height: widget.height ?? mq.size.height,
          color: _bg,
          child: Scaffold(
            backgroundColor: _bg,
            body: Column(
              children: [
                ListenableBuilder(
                  listenable: _Session(),
                  builder: (_, __) => _Header(
                    subtitle: _Session().subtitle,
                    trailing: _Pressable(
                      scale: 0.9,
                      onTap: _openProfile,
                      child: Container(
                        width: 38,
                        height: 38,
                        decoration: _liquid(circle: true, onDark: true),
                        child: const Icon(Icons.person_outline_rounded,
                            size: 19, color: _white),
                      ),
                    ),
                  ),
                ),
                Expanded(child: _body(mq)),
              ],
            ),
            bottomNavigationBar: const _BottomBar(current: 'shop'),
          ),
        ),
      ),
    );
  }

  Widget _body(MediaQueryData mq) {
    if (_loading) return _loadingState(mq);
    if (_error != null) {
      return _Empty(
        icon: Icons.cloud_off_rounded,
        tone: _ember,
        title: "Couldn't load the products",
        line: _error!,
        action: 'Try again',
        onAction: _load,
      );
    }

    final shown = _shown;

    return RefreshIndicator(
      color: _brand,
      onRefresh: _load,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(
            parent: BouncingScrollPhysics()),
        slivers: [
          SliverToBoxAdapter(child: _searchAndFilters()),
          if (shown.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: _Empty(
                icon: Icons.search_off_rounded,
                title: 'Nothing matches',
                line: _query.isEmpty
                    ? 'No products in this category yet.'
                    : 'No product matches "$_query".',
                action: 'Clear filters',
                onAction: () {
                  _search.clear();
                  setState(() {
                    _query = '';
                    _categoryId = null;
                  });
                },
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(14, 4, 14, 20),
              sliver: SliverGrid(
                gridDelegate:
                    const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 0.70,
                ),
                delegate: SliverChildBuilderDelegate(
                  (_, i) => _productTile(shown[i]),
                  childCount: shown.length,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _loadingState(MediaQueryData mq) => ListView(
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(14, 16, 14, 0),
        children: [
          _Skeleton(mq.size.width - 28, 46, radius: 14),
          const SizedBox(height: 14),
          const Row(
            children: [
              _Skeleton(56, 32, radius: 16),
              SizedBox(width: 8),
              _Skeleton(78, 32, radius: 16),
              SizedBox(width: 8),
              _Skeleton(70, 32, radius: 16),
            ],
          ),
          const SizedBox(height: 18),
          for (var row = 0; row < 3; row++) ...[
            const Row(
              children: [
                Expanded(child: _Skeleton(0, 190, radius: 18)),
                SizedBox(width: 12),
                Expanded(child: _Skeleton(0, 190, radius: 18)),
              ],
            ),
            const SizedBox(height: 12),
          ],
        ],
      );

  Widget _searchAndFilters() => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
            child: TextField(
              controller: _search,
              onChanged: (v) => setState(() => _query = v),
              cursorColor: _brand,
              style: _txt(15, color: _ink),
              decoration: InputDecoration(
                hintText: 'Search cement, iron bars, paint…',
                hintStyle: _txt(14.5, color: _light),
                prefixIcon:
                    const Icon(Icons.search_rounded, size: 20, color: _light),
                suffixIcon: _query.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.close_rounded,
                            size: 18, color: _mid),
                        onPressed: () {
                          _search.clear();
                          setState(() => _query = '');
                        },
                      ),
                filled: true,
                fillColor: _white,
                contentPadding: const EdgeInsets.symmetric(vertical: 14),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: _hairline),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: _hairline),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: _brand, width: 1.5),
                ),
              ),
            ),
          ),
          SizedBox(
            height: 34,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              children: [
                _filterChip('All', null),
                for (final c in _categories)
                  _filterChip(c['name'] as String, (c['id'] as num).toInt()),
              ],
            ),
          ),
          const SizedBox(height: 14),
        ],
      );

  Widget _filterChip(String label, int? id) {
    final on = _categoryId == id;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: _Pressable(
        scale: 0.94,
        onTap: () => setState(() => _categoryId = id),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          alignment: Alignment.center,
          decoration: on
              ? _liquid(tint: _brand, radius: 17)
              : BoxDecoration(
                  color: _white,
                  borderRadius: BorderRadius.circular(17),
                  border: Border.all(color: _hairline),
                ),
          child: Text(label,
              style: _txt(13,
                  weight: on ? FontWeight.w700 : FontWeight.w500,
                  color: on ? _white : _inkSoft)),
        ),
      ),
    );
  }

  Widget _productTile(Map<String, dynamic> p) {
    final stock = (p['stock_available'] as num?)?.toInt() ?? 0;
    final inCart = _CartStore().quantityOf((p['id'] as num).toInt());
    final colour = _categoryColour(p['category_name'] as String?);

    return _Pressable(
      scale: 0.97,
      onTap: () => _openProduct(p),
      child: Container(
        decoration: BoxDecoration(
          color: _white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: _hairline),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  _ProductPicture(product: p, colour: colour),
                  if (stock <= 0)
                    Positioned(
                      left: 8,
                      top: 8,
                      child: _Chip('Out of stock',
                          bg: _white.withOpacity(0.92), fg: _ember),
                    )
                  else if (inCart > 0)
                    Positioned(
                      left: 8,
                      top: 8,
                      child: _Chip('$inCart in cart',
                          bg: _white.withOpacity(0.92), fg: _brandDark),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(11, 10, 8, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(p['name'] as String? ?? '',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: _txt(13.5,
                          weight: FontWeight.w600, color: _ink, height: 1.25)),
                  const SizedBox(height: 2),
                  Text('per ${p['unit'] ?? 'unit'}',
                      style: _txt(11.5, color: _light)),
                  const SizedBox(height: 7),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          _ugx((p['price'] as num).toInt()),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: _title(14, weight: FontWeight.w800),
                        ),
                      ),
                      _Pressable(
                        scale: 0.86,
                        onTap: stock <= 0
                            ? null
                            : () async {
                                await _CartStore().add(p, 1);
                                if (!mounted) return;
                                setState(() {});
                                HapticFeedback.mediumImpact();
                              },
                        child: Container(
                          width: 30,
                          height: 30,
                          decoration: stock <= 0
                              ? BoxDecoration(
                                  color: _tile,
                                  borderRadius: BorderRadius.circular(9),
                                )
                              : _liquid(tint: _brand, radius: 9),
                          child: Icon(Icons.add_rounded,
                              size: 18, color: stock <= 0 ? _light : _white),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  SHEET — SIGN IN (phone, then the 6-digit code)
// ═══════════════════════════════════════════════════════════════

class _SignInSheet extends StatefulWidget {
  const _SignInSheet();

  @override
  State<_SignInSheet> createState() => _SignInSheetState();
}

class _SignInSheetState extends State<_SignInSheet> {
  final _formKey = GlobalKey<FormState>();
  final _phone = TextEditingController();
  final _code = TextEditingController();

  bool _sent = false;
  bool _busy = false;
  String? _error;
  String? _devCode;

  @override
  void dispose() {
    _phone.dispose();
    _code.dispose();
    super.dispose();
  }

  /// Ugandan numbers are 10 digits as people write them (0772 123 456),
  /// 9 without the leading zero, 12 with the country code. Nine is the
  /// shortest thing that could be real.
  String? _validatePhone(String? v) =>
      (v == null || v.replaceAll(RegExp(r'[^0-9]'), '').length < 9)
          ? 'Enter the phone number on your account.'
          : null;

  Future<void> _request() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final r = await _apiPost(
          '/api/auth/otp/request', {'phone': _phone.text.trim()});
      if (!mounted) return;
      setState(() {
        _sent = true;
        _busy = false;
        // In development the server hands the code straight back, so
        // nobody has to wire up an SMS gateway to try the app.
        _devCode = r['devCode']?.toString();
      });
    } on _ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _busy = false;
      });
    }
  }

  Future<void> _verify() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    // Captured before the await: this sheet is popped on success, so by
    // then its own context is gone.
    final navigator = Navigator.of(context);
    try {
      final r = await _apiPost('/api/auth/otp/verify', {
        'phone': _phone.text.trim(),
        'code': _code.text.trim(),
      });
      final user = (r['user'] as Map).cast<String, dynamic>();
      await _Session().save(r['token'] as String, user);

      // Sign-in gives companyId but not the company's name, and the name is
      // what the header shows. /auth/me returns the company row, so it is
      // folded in and saved again. A failure here is cosmetic only — the
      // sign-in itself already worked.
      if (user['companyId'] != null) {
        try {
          final me = await _apiGet('/api/auth/me');
          final full = (me['user'] as Map).cast<String, dynamic>();
          final company = full['company'] as Map<String, dynamic>?;
          if (company != null) full['companyName'] = company['company_name'];
          await _Session().save(r['token'] as String, full);
        } on _ApiError {
          // Keep the session we already have.
        }
      }
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      navigator.pop();

      // The number decides where you land. A manager signing in on their
      // own phone has no business being dropped into a shopping
      // catalogue, so the manager side opens instead.
      final role = user['role'] as String? ?? 'customer';
      if (role == 'manager') {
        navigator.pushReplacement(PageRouteBuilder(
          pageBuilder: (_, __, ___) => const AlHadeedManager(),
          transitionDuration: Duration.zero,
        ));
      } else if (role != 'customer') {
        // Cashier, Accounts and Store have no screen in this app yet.
        // Say so plainly and sign them back out, rather than leaving
        // them on a shop they cannot use.
        await showModalBottomSheet<void>(
          // This sheet has already been popped, so its own context is
          // gone; the navigator's outlives it.
          context: navigator.context,
          isScrollControlled: true,
          useSafeArea: true,
          backgroundColor: Colors.transparent,
          builder: (_) => _WrongSideSheet(role: role),
        );
        await _Session().signOut();
      }
    } on _ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _busy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);

    return _Sheet(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text('AL HADEED ',
                      style: _title(17, weight: FontWeight.w800)),
                  Text('HARDWARE',
                      style:
                          _title(17, weight: FontWeight.w800, color: _brand)),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                _sent
                    ? 'We sent a 6-digit code by SMS to '
                        '${_phone.text.trim()}. It expires in 5 minutes.'
                    : 'Enter your phone number and we will text you a '
                        'code. Company staff use their own number, not '
                        "the company's.",
                style: _txt(13, color: _mid, height: 1.45),
              ),
              const SizedBox(height: 18),
              if (!_sent)
                _Field(
                  controller: _phone,
                  hint: '+256 770 111 001',
                  keyboardType: TextInputType.phone,
                  autofocus: true,
                  validator: _validatePhone,
                )
              else ...[
                _Field(
                  controller: _code,
                  hint: '6-digit code',
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  autofocus: true,
                  onChanged: (_) => setState(() {}),
                ),
                if (_devCode != null) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: _brandPale,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.science_outlined,
                            size: 17, color: _brandDark),
                        const SizedBox(width: 9),
                        Expanded(
                          child: Text('Test mode: your code is $_devCode',
                              style: _txt(12.5, color: _brandDark)),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
              if (_error != null) ...[
                const SizedBox(height: 12),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.error_outline_rounded,
                        size: 16, color: _ember),
                    const SizedBox(width: 7),
                    Expanded(
                      child: Text(_error!,
                          style: _txt(12.5, color: _ember, height: 1.4)),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 20),
              _Pressable(
                scale: 0.98,
                onTap: _busy
                    ? null
                    : _sent
                        ? (_code.text.trim().length == 6 ? _verify : null)
                        : _request,
                child: Container(
                  height: 52,
                  width: double.infinity,
                  alignment: Alignment.center,
                  decoration: _liquid(tint: _brand, radius: 26),
                  child: _busy
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: _white),
                        )
                      : Text(_sent ? 'Verify & sign in' : 'Text me a code',
                          style: _txt(15,
                              weight: FontWeight.w600, color: _white)),
                ),
              ),
              if (_sent) ...[
                const SizedBox(height: 6),
                Center(
                  child: TextButton(
                    onPressed: _busy
                        ? null
                        : () => setState(() {
                              _sent = false;
                              _code.clear();
                              _devCode = null;
                              _error = null;
                            }),
                    child: Text('Use a different number',
                        style: _txt(13.5,
                            weight: FontWeight.w600, color: _brandDark)),
                  ),
                ),
              ],
              SizedBox(height: mq.padding.bottom + 4),
            ],
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  SHEET — ONE PRODUCT, WITH THE QUANTITY STEPPER
// ═══════════════════════════════════════════════════════════════

class _ProductSheet extends StatefulWidget {
  const _ProductSheet({required this.product});

  final Map<String, dynamic> product;

  @override
  State<_ProductSheet> createState() => _ProductSheetState();
}

class _ProductSheetState extends State<_ProductSheet> {
  int _qty = 1;

  int get _stock => (widget.product['stock_available'] as num?)?.toInt() ?? 0;
  int get _price => (widget.product['price'] as num).toInt();

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    final mq = MediaQuery.of(context);
    final colour = _categoryColour(p['category_name'] as String?);
    final low = _stock > 0 && _stock <= 5;

    return _Sheet(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: SizedBox(
                    width: 64,
                    height: 64,
                    child: (p['picture'] as String?)?.isNotEmpty == true
                        ? Image.network(
                            p['picture'] as String,
                            fit: BoxFit.cover,
                            cacheWidth: 200,
                            errorBuilder: (_, __, ___) =>
                                _initialTile(p, colour),
                            loadingBuilder: (_, child, progress) =>
                                progress == null
                                    ? child
                                    : ColoredBox(
                                        color: Color.lerp(
                                            colour, _white, 0.3)!),
                          )
                        : _initialTile(p, colour),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(p['name'] as String? ?? '', style: _title(18)),
                      const SizedBox(height: 4),
                      Text('${p['category_name'] ?? ''} · ${p['code'] ?? ''}',
                          style: _txt(12.5, color: _mid)),
                      const SizedBox(height: 6),
                      if (_stock <= 0)
                        const _Chip('Out of stock', bg: _emberPale, fg: _ember)
                      else
                        _Chip(
                          low
                              ? 'Only $_stock left'
                              : '$_stock ${p['unit'] ?? 'unit'} in stock',
                          bg: low ? _brandPale : _greenPale,
                          fg: low ? _brandDark : _green,
                        ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            Text(_ugx(_price), style: _title(26, weight: FontWeight.w800)),
            Text('per ${p['unit'] ?? 'unit'}', style: _txt(13, color: _mid)),
            if ((p['description'] as String?)?.isNotEmpty == true) ...[
              const SizedBox(height: 16),
              Text(p['description'] as String,
                  style: _txt(14, color: _inkSoft, height: 1.5)),
            ],
            const SizedBox(height: 20),
            Row(
              children: [
                Text('Quantity',
                    style: _txt(14.5, weight: FontWeight.w600, color: _ink)),
                const Spacer(),
                _stepButton(Icons.remove_rounded,
                    onTap: _qty > 1 ? () => setState(() => _qty--) : null),
                SizedBox(
                  width: 54,
                  child: Text('$_qty',
                      textAlign: TextAlign.center,
                      style: _title(18, weight: FontWeight.w700)),
                ),
                // Capped at what is actually on the shelf: the API
                // refuses an over-stock order anyway, and finding that
                // out at the cashier's desk is too late.
                _stepButton(Icons.add_rounded,
                    onTap: _qty < _stock ? () => setState(() => _qty++) : null),
              ],
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: _tile,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                children: [
                  Text('Line total', style: _txt(13.5, color: _inkSoft)),
                  const Spacer(),
                  Text(_ugx(_price * _qty),
                      style: _title(17, weight: FontWeight.w800)),
                ],
              ),
            ),
            const SizedBox(height: 18),

            // "Order now" is the primary action, not "Buy": no money
            // changes hands in the app. The order goes to the cashier's
            // queue and is paid for at the counter, so anything that
            // sounds like a purchase would promise the wrong thing.
            _Pressable(
              scale: 0.98,
              onTap: _stock <= 0 ? null : () => _order(straightToCart: true),
              child: Container(
                height: 52,
                width: double.infinity,
                alignment: Alignment.center,
                decoration: _stock <= 0
                    ? BoxDecoration(
                        color: _tile,
                        borderRadius: BorderRadius.circular(26),
                        border: Border.all(color: _hairline),
                      )
                    : _liquid(tint: _brand, radius: 26),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.arrow_forward_rounded,
                        size: 18, color: _stock <= 0 ? _light : _white),
                    const SizedBox(width: 8),
                    Text(
                      _stock <= 0 ? 'Out of stock' : 'Proceed to order',
                      style: _txt(15,
                          weight: FontWeight.w600,
                          color: _stock <= 0 ? _light : _white),
                    ),
                  ],
                ),
              ),
            ),
            if (_stock > 0) ...[
              const SizedBox(height: 9),
              // For the builder's run: keep adding, order the lot at the
              // end. Secondary, because ordering one thing is the
              // commoner errand.
              _Pressable(
                scale: 0.98,
                onTap: () => _order(straightToCart: false),
                child: Container(
                  height: 48,
                  width: double.infinity,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: _tile,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: _hairline),
                  ),
                  child: Text('Add and keep shopping',
                      style: _txt(14.5,
                          weight: FontWeight.w600, color: _inkSoft)),
                ),
              ),
            ],
            SizedBox(height: mq.padding.bottom + 4),
          ],
        ),
      ),
    );
  }

  /// Put the line in the order and either go and confirm it, or stay on
  /// the shop for the next item.
  Future<void> _order({required bool straightToCart}) async {
    final navigator = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);
    await _CartStore().add(widget.product, _qty);
    if (!mounted) return;
    HapticFeedback.mediumImpact();
    navigator.pop();

    if (straightToCart) {
      navigator.pushReplacement(PageRouteBuilder(
        pageBuilder: (_, __, ___) => const AlHadeedCart(),
        transitionDuration: Duration.zero,
      ));
      return;
    }

    messenger.showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        backgroundColor: _ink,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        content: Text('$_qty added to your order.',
            style: _txt(13.5, color: _white)),
      ),
    );
  }

  Widget _stepButton(IconData icon, {VoidCallback? onTap}) => _Pressable(
        scale: 0.86,
        onTap: onTap,
        child: Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: onTap == null ? _tile : _white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: _hairline),
          ),
          child: Icon(icon, size: 18, color: onTap == null ? _light : _ink),
        ),
      );
}

// ═══════════════════════════════════════════════════════════════
//  SHEET — WHO AM I (and sign out)
// ═══════════════════════════════════════════════════════════════

class _ProfileSheet extends StatelessWidget {
  const _ProfileSheet();

  @override
  Widget build(BuildContext context) {
    final s = _Session();
    final mq = MediaQuery.of(context);

    return _Sheet(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: const BoxDecoration(
                      color: _brandPale, shape: BoxShape.circle),
                  alignment: Alignment.center,
                  child: Text(
                    s.fullName.isEmpty
                        ? '?'
                        : s.fullName.characters.first.toUpperCase(),
                    style:
                        _title(22, weight: FontWeight.w800, color: _brandDark),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(s.fullName, style: _title(18)),
                      const SizedBox(height: 3),
                      Text(s.phone, style: _txt(13, color: _mid)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            _row(
                'Account',
                switch (s.accountType) {
                  'company_owner' => 'Company owner',
                  'company_staff' => 'Company staff',
                  _ => 'Individual',
                }),
            if (s.isCompany) _row('Company', s.companyName),
            if (s.staffRole != null) _row('Role at the company', s.staffRole!),
            if (s.spendingLimit != null)
              _row('Spending limit per order', _ugx(s.spendingLimit!)),
            const SizedBox(height: 20),
            _Pressable(
              scale: 0.98,
              onTap: () async {
                final navigator = Navigator.of(context);
                await _Session().signOut();
                await _CartStore().clear();
                navigator.pop();
              },
              child: Container(
                height: 50,
                width: double.infinity,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: _emberPale,
                  borderRadius: BorderRadius.circular(25),
                ),
                child: Text('Sign out',
                    style: _txt(15, weight: FontWeight.w600, color: _ember)),
              ),
            ),
            SizedBox(height: mq.padding.bottom + 4),
          ],
        ),
      ),
    );
  }

  Widget _row(String k, String v) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: Text(k, style: _txt(14, color: _mid))),
            const SizedBox(width: 12),
            Expanded(
              child: Text(v,
                  textAlign: TextAlign.right,
                  style: _txt(14, weight: FontWeight.w600, color: _ink)),
            ),
          ],
        ),
      );
}

// ═══════════════════════════════════════════════════════════════
//  SHEET — THIS NUMBER BELONGS TO ANOTHER DESK
// ═══════════════════════════════════════════════════════════════

/// Shown when a cashier, accounts clerk or store manager signs in here.
///
/// Their number is perfectly valid — it just belongs to a desk this app
/// does not carry yet. Saying which desk, and where it lives instead, is
/// more use than dropping them on a shop screen they cannot work from.
class _WrongSideSheet extends StatelessWidget {
  const _WrongSideSheet({required this.role});

  final String role;

  String get _desk => switch (role) {
        'cashier' => 'Cashier',
        'accounts' => 'Accounts',
        'store' => 'Store Manager',
        _ => role,
      };

  String get _where => switch (role) {
        'cashier' || 'accounts' =>
          'Your desk is on the web panel — open it on the counter computer '
              'and sign in with the same number or your email.',
        'store' =>
          'The Store Manager screen is not in this app yet. Use the existing '
              'Al Hadeed app on the shop tablet in the meantime.',
        _ => 'That desk is not part of this app.',
      };

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);

    return _Sheet(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration:
                  const BoxDecoration(color: _bluePale, shape: BoxShape.circle),
              child: const Icon(Icons.swap_horiz_rounded,
                  size: 26, color: _blue),
            ),
            const SizedBox(height: 14),
            Text('That is the $_desk desk', style: _title(20)),
            const SizedBox(height: 6),
            Text(_where, style: _txt(13.5, color: _mid, height: 1.5)),
            const SizedBox(height: 20),
            _Pressable(
              scale: 0.98,
              onTap: () => Navigator.of(context).pop(),
              child: Container(
                height: 50,
                width: double.infinity,
                alignment: Alignment.center,
                decoration: _liquid(tint: _navy, radius: 25),
                child: Text('Got it',
                    style: _txt(14.5, weight: FontWeight.w600, color: _white)),
              ),
            ),
            SizedBox(height: mq.padding.bottom + 4),
          ],
        ),
      ),
    );
  }
}
