// Automatic FlutterFlow imports
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/custom_code/widgets/index.dart'; // Imports other custom widgets
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart' hide RepeatMode;
// Begin custom widget code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!

// ╔═══════════════════════════════════════════════════════════════╗
// ║  NAME THIS CUSTOM WIDGET:   AlHadeedManager                   ║
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
//     AlHadeedManager
//
// Spelling and capitals both matter. Then switch on "Width and Height
// (required)" — this widget already accepts them — and Save.
//
// The desks on a phone — cashier, accounts, store, manager.


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
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';

// ═══════════════════════════════════════════════════════════════
//  WHERE THE API LIVES
//
//  The one line to change when you deploy. Must match the value in
//  al_hadeed_shop.dart, al_hadeed_cart.dart,
//  al_hadeed_orders.dart and al_hadeed_company.dart.
//
//  On a real phone `localhost` means the phone itself, so while testing
//  use the computer's LAN address: http://192.168.1.14:4000
// ═══════════════════════════════════════════════════════════════
const String _apiBase = 'https://pearlfx.online';

// Everything from here down to the screen itself is repeated, identically,
// in all five screen files. That is deliberate: FlutterFlow generates
// `custom_code/widgets/index.dart` as a list of
// `export 'al_hadeed_manager.dart' show AlHadeedManager;` lines, so a widget
// class is the only thing that crosses from one custom widget file to
// another. A shared helper is simply not visible, and the build fails
// with "The function '_txt' isn't defined".

// ═══════════════════════════════════════════════════════════════
//  TOKENS — identical in shop, cart, orders, company and manager.
// ═══════════════════════════════════════════════════════════════
const Color _white = Color(0xFFFFFFFF);
const Color _bg = Color(0xFFF3F6F4);
const Color _ink = Color(0xFF0F1B33);
const Color _inkSoft = Color(0xFF394862);
const Color _mid = Color(0xFF55637D);
const Color _light = Color(0xFF626F88);
const Color _hairline = Color(0xFFEEF2EF);
const Color _tile = Color(0xFFF2F5F3);
const Color _navy = Color(0xFF0E201A);
const Color _navyDark = Color(0xFF081511);
// #92D050 is the shop's green. It is light, so what sits on it is dark
// (_onLime); green words and marks on white use the deeper _brand.
const Color _lime = Color(0xFF92D050);
const Color _onLime = Color(0xFF102108);
const Color _brand = Color(0xFF3F7A12);
const Color _brandDark = Color(0xFF2F5E0C);
const Color _brandPale = Color(0xFFF0F8E6);
const Color _green = Color(0xFF0E7444);
const Color _greenPale = Color(0xFFE6F6ED);
const Color _blue = Color(0xFF0B658D);
const Color _bluePale = Color(0xFFE3F3FB);
const Color _amber = Color(0xFF9A5205);
const Color _amberPale = Color(0xFFFEF3E0);
const Color _ember = Color(0xFFC02B2B);
const Color _emberPale = Color(0xFFFDECEC);

const Cubic _ease = Cubic(0.23, 1, 0.32, 1);

/// Soft depth for cards: a tight contact shadow and a wide faint one —
/// the same layered shadow the staff panel's cards use.
const List<BoxShadow> _cardShadow = [
  BoxShadow(color: Color(0x0F12301F), blurRadius: 20, offset: Offset(0, 6)),
  BoxShadow(color: Color(0x0A12301F), blurRadius: 3, offset: Offset(0, 1)),
];

/// The brand's blue, deepening — hero cards, the header, the add button.
const LinearGradient _heroGradient = LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: [_lime, _lime],
);

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
  final s = size * _ui * 0.92; // one size step smaller everywhere
  return TextStyle(
    // Plus Jakarta Sans: one modern, premium face on every screen.
    fontFamily: _face,
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

/// Loaded once by google_fonts, then cached on the phone.
final String? _face = GoogleFonts.plusJakartaSans().fontFamily;

/// Cards and rows rise into place, one after another.
Widget _rise(Widget w, [int i = 0]) => w
    .animate()
    .fadeIn(duration: 280.ms, delay: (i.clamp(0, 8) * 35).ms)
    .slideY(begin: 0.06, end: 0, duration: 320.ms, delay: (i.clamp(0, 8) * 35).ms, curve: Curves.easeOutCubic);

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
    fill = [tint, tint];
    rim = _white.withOpacity(0.40);
  } else if (onDark) {
    fill = [_white.withOpacity(0.16), _white.withOpacity(0.16)];
    rim = _white.withOpacity(0.42);
  } else {
    fill = const [_white, _white];
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
                colors: [_white.withOpacity(0.82), _white.withOpacity(0.66)],
              ),
              boxShadow: _cardShadow,
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
  Widget build(BuildContext context) => Container(
        width: widget.width == 0 ? null : widget.width,
        height: widget.height,
        decoration: BoxDecoration(
          color: _tile,
          borderRadius: BorderRadius.circular(widget.radius),
        ),
      )
          .animate(onPlay: (c) => c.repeat())
          .shimmer(duration: 1300.ms, color: _white.withOpacity(0.75));
}

/// A text field styled to match the tiles, with no Material underline
/// or outline fighting the flat look.
class _Field extends StatelessWidget {
  const _Field({
    super.key,
    required this.controller,
    this.obscure = false,
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
  final bool obscure;
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
        obscureText: obscure,
        autocorrect: !obscure,
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
              const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide.none,
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
  _ApiError(this.message, {this.unauthorised = false, this.code});
  final String message;
  final String? code;
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
      code: body['code']?.toString(),
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
    } else {
      user = null;
    }
    notifyListeners();
  }

  bool get signedIn => token != null && user != null;

  /// 'customer', or the desk: 'store' | 'cashier' | 'accounts' | 'manager'.
  String get role => user?['role'] as String? ?? 'customer';
  bool get isStaff => signedIn && role != 'customer';
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
    if (!signedIn) return 'Browse the shop, sign in to order';
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
      'pending_payment' => (_amberPale, _amber),
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

class _Chip extends StatelessWidget {
  const _Chip(this.label,
      {required this.bg, required this.fg, this.bold = true});

  final String label;
  final Color bg;
  final Color fg;
  final bool bold;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
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
        transitionDuration: const Duration(milliseconds: 180),
        reverseTransitionDuration: const Duration(milliseconds: 140),
        transitionsBuilder: (_, a, __, child) =>
            FadeTransition(opacity: CurvedAnimation(parent: a, curve: Curves.easeOut), child: child),
      ));

  @override
  Widget build(BuildContext context) {
    final owner = _Session().isCompanyOwner;
    // Outline when idle, filled where you are.
    final items = <(String, String, IconData, IconData, Widget)>[
      ('shop', 'Shop', Icons.storefront_outlined, Icons.storefront_rounded,
          const AlHadeedShop()),
      ('cart', 'Cart', Icons.shopping_cart_outlined,
          Icons.shopping_cart_rounded, const AlHadeedCart()),
      ('orders', 'Orders', Icons.receipt_long_outlined,
          Icons.receipt_long_rounded, const AlHadeedOrders()),
      (
        'company',
        owner ? 'Company' : 'Account',
        owner ? Icons.business_outlined : Icons.person_outline_rounded,
        owner ? Icons.business_rounded : Icons.person_rounded,
        const AlHadeedCompany()
      ),
    ];

    // A floating bar rather than a slab across the bottom: it sits on
    // the page, and the tab you are on is lit by a soft pill.
    return Padding(
      padding: EdgeInsets.fromLTRB(
          16, 6, 16, MediaQuery.paddingOf(context).bottom + 10),
      child: _Glass(
        radius: 24,
        blur: 18,
        padding: const EdgeInsets.all(6),
        child: Row(
          children: [
            for (final (key, label, icon, iconOn, page) in items)
              Expanded(
                child: _Pressable(
                  scale: 0.94,
                  onTap: key == current ? null : () => _go(context, page),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 220),
                    curve: _ease,
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    decoration: BoxDecoration(
                      color:
                          key == current ? _brandPale : _white.withOpacity(0),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Stack(
                          clipBehavior: Clip.none,
                          children: [
                            Icon(key == current ? iconOn : icon,
                                size: 21,
                                color: key == current ? _brand : _light),
                            if (key == 'cart')
                              ListenableBuilder(
                                listenable: _CartStore(),
                                builder: (_, __) {
                                  final n = _CartStore().count;
                                  if (n == 0) return const SizedBox.shrink();
                                  return Positioned(
                                    right: -9,
                                    top: -6,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 5, vertical: 1),
                                      decoration: BoxDecoration(
                                        gradient: _heroGradient,
                                        borderRadius: BorderRadius.circular(9),
                                        border:
                                            Border.all(color: _onLime, width: 2),
                                      ),
                                      constraints:
                                          const BoxConstraints(minWidth: 19),
                                      child: Text('$n',
                                          textAlign: TextAlign.center,
                                          style: _txt(10,
                                              weight: FontWeight.w800,
                                              color: _onLime)),
                                    ),
                                  );
                                },
                              ),
                          ],
                        ),
                        const SizedBox(height: 3),
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
              ),
          ],
        ),
      ),
    );
  }
}

/// The header every screen wears: the brand's blue, rounded at its foot.
class _Header extends StatelessWidget {
  const _Header({required this.subtitle, this.trailing});

  final String subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        clipBehavior: Clip.antiAlias,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFA6DD6A), _lime, Color(0xFF7FC23F)],
          ),
          borderRadius: BorderRadius.vertical(bottom: Radius.circular(28)),
          boxShadow: [
            BoxShadow(color: Color(0x2E5C8F27), blurRadius: 24, offset: Offset(0, 8)),
          ],
        ),
        child: Stack(
          children: [
            // A soft light in the corner, so the blue has depth rather
            // than being a flat slab.
            Positioned(
              right: -60,
              top: -90,
              child: Container(
                width: 230,
                height: 230,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(colors: [
                    _white.withOpacity(0.38),
                    _white.withOpacity(0),
                  ]),
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(
                  16, MediaQuery.paddingOf(context).top + 10, 14, 14),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: _onLime.withOpacity(0.10),
                      borderRadius: BorderRadius.circular(13),
                      border: Border.all(color: _onLime.withOpacity(0.18)),
                    ),
                    child: Text('AH',
                        style: _title(14,
                            weight: FontWeight.w800, color: _onLime)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Just the name, big and heavy: no second line.
                        Text('Al Hadeed',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: _title(24,
                                weight: FontWeight.w900, color: _onLime)),
                      ],
                    ),
                  ),
                  if (trailing != null) trailing!,
                ],
              ),
            ),
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
  Widget build(BuildContext context) => _rise(Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // A soft rounded tile with a ring, not a flat grey disc.
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: tone == _ember
                        ? [_emberPale, _emberPale]
                        : [_brandPale, _brandPale],
                  ),
                  borderRadius: BorderRadius.circular(26),
                  border: Border.all(
                      color: tone == _ember
                          ? _ember.withOpacity(0.18)
                          : _brand.withOpacity(0.14)),
                ),
                child: Icon(icon,
                    size: 32, color: tone == _ember ? _ember : _brand),
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
                    decoration: _liquid(tint: _lime, radius: 23),
                    child: Text(action!,
                        style:
                            _txt(15, weight: FontWeight.w600, color: _onLime)),
                  ),
                ),
              ],
            ],
          ),
        ),
      ));
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
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 22, sigmaY: 22),
        child: Container(
        decoration: BoxDecoration(
          color: _white.withOpacity(0.9),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          border: Border(top: BorderSide(color: _white.withOpacity(0.9), width: 1.2)),
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
//  THE MANAGER SIDE
// ═══════════════════════════════════════════════════════════════

/// Where a manager's phone number lands after signing in.
///
/// The manager does not shop, so none of the customer chrome belongs
/// here — no cart, no bottom bar. One scrolling overview of the whole
/// shop, and the two things a manager actually has to *do* from a
/// phone: look into a stage that is backing up, and decide a refund.
class AlHadeedManager extends StatefulWidget {
  const AlHadeedManager({super.key, this.width, this.height});

  /// FlutterFlow fills these in from the canvas when "Width and Height"
  /// is switched on. They are not something to wire up, but the
  /// constructor has to accept them or saving fails with:
  /// Parameter "width" not found.
  final double? width;
  final double? height;

  @override
  State<AlHadeedManager> createState() => _AlHadeedManagerState();
}

class _AlHadeedManagerState extends State<AlHadeedManager> {
  Map<String, dynamic>? _data;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    await _Session().load();
    if (!mounted) return;
    await _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final r = await _apiGet('/api/manager/dashboard');
      if (!mounted) return;
      setState(() {
        _data = r;
        _loading = false;
      });
    } on _ApiError catch (e) {
      if (!mounted) return;
      if (e.unauthorised) {
        await _Session().signOut();
        if (!mounted) return;
        Navigator.of(context).pushReplacement(PageRouteBuilder(
          pageBuilder: (_, __, ___) => const AlHadeedShop(),
          transitionDuration: Duration.zero,
        ));
        return;
      }
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  Future<void> _openStage(String stage, String label) =>
      showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        backgroundColor: Colors.transparent,
        builder: (_) => _StageSheet(stage: stage, label: label),
      );

  Future<void> _openRefund(Map<String, dynamic> refund) =>
      showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        backgroundColor: Colors.transparent,
        builder: (_) => _RefundSheet(refund: refund),
      ).then((decided) {
        if (decided == true) _load();
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
                _Header(
                  subtitle: 'Manager · ${_Session().fullName}',
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _Pressable(
                        scale: 0.9,
                        onTap: _load,
                        child: Container(
                          width: 38,
                          height: 38,
                          decoration: _liquid(circle: true, onDark: true),
                          child: const Icon(Icons.refresh_rounded,
                              size: 19, color: _onLime),
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(child: _body(mq)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _body(MediaQueryData mq) {
    if (_loading) {
      return ListView(
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
        children: [
          _Skeleton(mq.size.width - 28, 96, radius: 18),
          const SizedBox(height: 12),
          _Skeleton(mq.size.width - 28, 78, radius: 16),
          const SizedBox(height: 12),
          _Skeleton(mq.size.width - 28, 170, radius: 18),
        ],
      );
    }

    if (_error != null || _data == null) {
      return _Empty(
        icon: Icons.cloud_off_rounded,
        tone: _ember,
        title: "Couldn't load the dashboard",
        line: _error ?? 'Try again in a moment.',
        action: 'Try again',
        onAction: _load,
      );
    }

    final d = _data!;
    final byMethod = (d['byMethod'] as Map?)?.cast<String, dynamic>() ?? {};
    final byStage = (d['byStage'] as Map?)?.cast<String, dynamic>() ?? {};
    final lowStock =
        ((d['lowStock'] as List?) ?? const []).cast<Map<String, dynamic>>();
    final refunds = ((d['pendingRefunds'] as List?) ?? const [])
        .cast<Map<String, dynamic>>();

    return RefreshIndicator(
      color: _brand,
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(
            parent: BouncingScrollPhysics()),
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
        children: [
          // The headline. One number, stated in words — not a chart,
          // because there is nothing here to compare.
          // The day's sales, as the panel shows it: deep blue, the week
          // drawn faintly in its corner.
          Container(
            width: double.infinity,
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              gradient: _heroGradient,
              borderRadius: BorderRadius.circular(22),
            ),
            child: Stack(
              children: [
                Positioned(
                  right: -50,
                  top: -70,
                  child: Container(
                    width: 200,
                    height: 200,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: RadialGradient(colors: [
                        _white.withOpacity(0),
                        _white.withOpacity(0),
                      ]),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 34,
                            height: 34,
                            decoration: BoxDecoration(
                              color: _white.withOpacity(0.16),
                              borderRadius: BorderRadius.circular(11),
                              border: Border.all(
                                  color: _white.withOpacity(0.22)),
                            ),
                            child: const Icon(Icons.payments_outlined,
                                size: 18, color: _onLime),
                          ),
                          const SizedBox(width: 10),
                          Text('Sales today',
                              style: _txt(13,
                                  weight: FontWeight.w600,
                                  color: _onLime.withOpacity(0.85))),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Text(_ugx((d['salesToday'] as num?)?.toInt() ?? 0),
                          style: _title(31,
                              weight: FontWeight.w800, color: _onLime)),
                      const SizedBox(height: 8),
                      Text('${d['ordersToday'] ?? 0} orders today',
                          style:
                              _txt(13, color: _onLime.withOpacity(0.8))),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          Row(
            children: [
              Expanded(
                  child: _tile('Cash', _ugx(
                      (byMethod['cash'] as num?)?.toInt() ?? 0),
                      icon: Icons.payments_outlined, accent: _green)),
              const SizedBox(width: 10),
              Expanded(
                  child: _tile('Mobile Money', _ugx(
                      (byMethod['mobile_money'] as num?)?.toInt() ?? 0),
                      icon: Icons.phone_iphone_rounded, accent: _brand)),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                  child: _tile('Card', _ugx(
                      (byMethod['card'] as num?)?.toInt() ?? 0),
                      icon: Icons.credit_card_rounded, accent: _blue)),
              const SizedBox(width: 10),
              Expanded(
                child: _tile(
                  'Low stock',
                  '${lowStock.length}',
                  tone: lowStock.isEmpty ? null : _ember,
                  icon: Icons.inventory_2_outlined,
                  accent: lowStock.isEmpty ? _green : _ember,
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),
          const _ApprovalsCard(),
          const _BooksCard(),
          const SizedBox(height: 8),
          Text('ORDERS BY STAGE (LIVE)',
              style: _txt(11.5, weight: FontWeight.w700, color: _light)),
          const SizedBox(height: 10),
          Row(
            children: [
              _stageTile('Cashier', 'cashier', byStage),
              const SizedBox(width: 8),
              _stageTile('Accounts', 'accounts', byStage),
              const SizedBox(width: 8),
              _stageTile('Store', 'store', byStage),
              const SizedBox(width: 8),
              _stageTile('Done', 'done', byStage, tappable: false),
            ],
          ),

          const SizedBox(height: 22),
          _salesChart(
              ((d['last7Days'] as List?) ?? const [])
                  .cast<Map<String, dynamic>>()),

          if (refunds.isNotEmpty) ...[
            const SizedBox(height: 22),
            Text('REFUNDS WAITING ON YOU',
                style: _txt(11.5, weight: FontWeight.w700, color: _light)),
            const SizedBox(height: 10),
            for (final r in refunds) _refundCard(r),
          ],

          if (lowStock.isNotEmpty) ...[
            const SizedBox(height: 22),
            Text('LOW STOCK',
                style: _txt(11.5, weight: FontWeight.w700, color: _light)),
            const SizedBox(height: 10),
            Container(
              decoration: BoxDecoration(
                color: _white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: _cardShadow,
              ),
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: [
                  for (var i = 0; i < lowStock.length; i++) ...[
                    if (i > 0)
                      const Padding(
                        padding: EdgeInsets.only(left: 14),
                        child: Divider(
                            height: 1, thickness: 1, color: _hairline),
                      ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                    lowStock[i]['name'] as String? ?? '',
                                    style: _txt(13.5,
                                        weight: FontWeight.w600,
                                        color: _ink)),
                                const SizedBox(height: 2),
                                Text(
                                  'reorder at '
                                  '${lowStock[i]['reorder_level'] ?? 0}',
                                  style: _txt(12, color: _mid),
                                ),
                              ],
                            ),
                          ),
                          _Chip(
                            '${lowStock[i]['stock_available'] ?? 0} '
                            '${lowStock[i]['unit'] ?? ''} left',
                            bg: (lowStock[i]['stock_available'] as num?) == 0
                                ? _emberPale
                                : _brandPale,
                            fg: (lowStock[i]['stock_available'] as num?) == 0
                                ? _ember
                                : _brandDark,
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  /// A figure, as the panel draws one: an icon in a soft tinted tile,
  /// the label beside it, the number large beneath.
  Widget _tile(String label, String value,
          {Color? tone, IconData? icon, Color accent = _brand}) =>
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: _white,
          borderRadius: BorderRadius.circular(18),
          boxShadow: _cardShadow,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (icon != null) ...[
                  Container(
                    width: 30,
                    height: 30,
                    decoration: BoxDecoration(
                      color: accent.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(icon, size: 16, color: accent),
                  ),
                  const SizedBox(width: 8),
                ],
                Expanded(
                  child: Text(label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: _txt(12, weight: FontWeight.w600, color: _mid)),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: _title(18,
                    weight: FontWeight.w800, color: tone ?? _ink)),
          ],
        ),
      );

  Widget _stageTile(String label, String key, Map<String, dynamic> byStage,
      {bool tappable = true}) {
    final n = (byStage[key] as num?)?.toInt() ?? 0;
    return Expanded(
      child: _Pressable(
        scale: 0.95,
        onTap: tappable && n > 0 ? () => _openStage(key, label) : null,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: _white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
                color: n > 0 && tappable
                    ? _brand.withOpacity(0.22)
                    : _hairline.withOpacity(0.7)),
          ),
          child: Column(
            children: [
              // Blue where a desk has work; quiet where it has none.
              Text('$n',
                  style: _title(22,
                      weight: FontWeight.w800,
                      color: n > 0 && tappable ? _brand : _ink)),
              const SizedBox(height: 3),
              Text(label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: _txt(11.5, color: _mid)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _refundCard(Map<String, dynamic> r) => _Pressable(
        scale: 0.98,
        onTap: () => _openRefund(r),
        child: Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: _white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: _ember.withOpacity(0.35)),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text('#${r['order_no'] ?? ''}',
                            style: _txt(14,
                                weight: FontWeight.w700, color: _ink)),
                        const SizedBox(width: 8),
                        _Chip(_ugx((r['amount'] as num?)?.toInt() ?? 0),
                            bg: _emberPale, fg: _ember),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(r['reason'] as String? ?? '',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: _txt(12.5, color: _mid, height: 1.35)),
                    const SizedBox(height: 2),
                    Text('asked by ${r['requested_by_name'] ?? ''}',
                        style: _txt(11.5, color: _light)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded,
                  size: 20, color: _light),
            ],
          ),
        ),
      );

  // --- The chart --------------------------------------------------------

  /// Sales over the last seven days.
  ///
  /// One series, so no legend — the title names it. The orange of the
  /// bars does not carry 3:1 against this surface, so the figures are
  /// never left to colour alone: the day under every bar, and the exact
  /// amount for whichever day is selected (today, until you tap another).
  ///
  /// The API returns only days that had sales, so the missing ones are
  /// filled in at zero here. Seven bars with gaps is the truth; one bar
  /// labelled "last 7 days" is not.
  Widget _salesChart(List<Map<String, dynamic>> raw) {
    final byDay = <String, int>{
      for (final r in raw)
        (r['day'] as String? ?? ''): (r['total'] as num?)?.toInt() ?? 0,
    };

    final today = DateTime.now();
    final days = <(String, String, int, bool)>[];
    for (var i = 6; i >= 0; i--) {
      final d = DateTime(today.year, today.month, today.day)
          .subtract(Duration(days: i));
      final key = '${d.year.toString().padLeft(4, '0')}-'
          '${d.month.toString().padLeft(2, '0')}-'
          '${d.day.toString().padLeft(2, '0')}';
      const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      days.add((key, i == 0 ? 'Today' : names[d.weekday - 1],
          byDay[key] ?? 0, i == 0));
    }

    final selected = _selectedDay.clamp(0, days.length - 1);
    final max = days.fold<int>(0, (m, d) => d.$3 > m ? d.$3 : m);

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
      decoration: BoxDecoration(
        color: _white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: _cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Sales, last 7 days', style: _title(15.5)),
          const SizedBox(height: 2),
          // The selected day, in words. This is the chart's label layer:
          // it is what makes the bars readable without relying on colour.
          Text(
            '${days[selected].$2} · ${_ugx(days[selected].$3)}',
            style: _txt(13, weight: FontWeight.w600, color: _brandDark),
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 108,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (var i = 0; i < days.length; i++) ...[
                  if (i > 0) const SizedBox(width: 2),
                  Expanded(
                    child: _Pressable(
                      scale: 0.94,
                      onTap: () => setState(() => _selectedDay = i),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          // Anchored to the baseline, rounded at the data
                          // end only, with a floor of 3px so a zero day is
                          // still visibly a day.
                          AnimatedContainer(
                            duration: const Duration(milliseconds: 320),
                            curve: _ease,
                            height: max == 0
                                ? 3
                                : (3 + (days[i].$3 / max) * 82),
                            // The chosen day in solid green;
                            // the rest a pale wash of the same.
                            decoration: BoxDecoration(
                              gradient: i == selected
                                  ? _heroGradient
                                  : LinearGradient(
                                      begin: Alignment.topCenter,
                                      end: Alignment.bottomCenter,
                                      colors: [
                                        _brand.withOpacity(0.22),
                                        _brand.withOpacity(0.22),
                                      ],
                                    ),
                              borderRadius: const BorderRadius.vertical(
                                  top: Radius.circular(8),
                                  bottom: Radius.circular(3)),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            days[i].$2,
                            maxLines: 1,
                            overflow: TextOverflow.clip,
                            style: _txt(10.5,
                                weight: i == selected
                                    ? FontWeight.w700
                                    : FontWeight.w400,
                                color: i == selected ? _ink : _light),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 4),
          const Divider(height: 1, thickness: 1, color: _hairline),
          const SizedBox(height: 8),
          Text('Tap a day to read its total.',
              style: _txt(11.5, color: _light)),
        ],
      ),
    );
  }

  int _selectedDay = 6;
}

// ═══════════════════════════════════════════════════════════════
//  SHEET — WHAT IS SITTING AT ONE STAGE
// ═══════════════════════════════════════════════════════════════

/// The orders waiting at a desk. The manager's question when a number
/// on the dashboard looks wrong is always "which ones?", so that is
/// one tap away.
class _StageSheet extends StatefulWidget {
  const _StageSheet({required this.stage, required this.label});

  final String stage;
  final String label;

  @override
  State<_StageSheet> createState() => _StageSheetState();
}

class _StageSheetState extends State<_StageSheet> {
  List<Map<String, dynamic>> _orders = [];
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await _apiGet('/api/orders/queue/${widget.stage}');
      if (!mounted) return;
      setState(() {
        _orders = (r['orders'] as List).cast<Map<String, dynamic>>();
        _loading = false;
      });
    } on _ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

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
            Text('At ${widget.label}', style: _title(21)),
            const SizedBox(height: 4),
            Text(
              _loading
                  ? 'Loading…'
                  : '${_orders.length} '
                      '${_orders.length == 1 ? 'order is' : 'orders are'} '
                      'waiting at this desk.',
              style: _txt(13, color: _mid, height: 1.45),
            ),
            const SizedBox(height: 16),
            if (_loading)
              const Column(
                children: [
                  _Skeleton(0, 64, radius: 14),
                  SizedBox(height: 8),
                  _Skeleton(0, 64, radius: 14),
                ],
              )
            else if (_error != null)
              Text(_error!, style: _txt(13.5, color: _ember))
            else if (_orders.isEmpty)
              Text('Nothing waiting here. The desk is clear.',
                  style: _txt(13.5, color: _mid))
            else
              for (final o in _orders)
                Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: _tile,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('#${o['order_no'] ?? ''}',
                                style: _txt(14,
                                    weight: FontWeight.w700, color: _ink)),
                            const SizedBox(height: 3),
                            Text(
                              '${o['company_name'] ?? o['ordered_by_name'] ?? ''}'
                              ' · ${_when(o['created_at'] as String?)}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: _txt(12, color: _mid),
                            ),
                          ],
                        ),
                      ),
                      Text(_ugx((o['total'] as num?)?.toInt() ?? 0),
                          style: _txt(14,
                              weight: FontWeight.w800, color: _ink)),
                    ],
                  ),
                ),
            SizedBox(height: mq.padding.bottom + 4),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  SHEET — DECIDE A REFUND
// ═══════════════════════════════════════════════════════════════

/// Approve or decline, with a note. Approving moves money out of the
/// cash book and tells the customer, so the amount is stated in full
/// rather than abbreviated.
class _RefundSheet extends StatefulWidget {
  const _RefundSheet({required this.refund});

  final Map<String, dynamic> refund;

  @override
  State<_RefundSheet> createState() => _RefundSheetState();
}

class _RefundSheetState extends State<_RefundSheet> {
  final _notes = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Future<void> _decide(bool approve) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final navigator = Navigator.of(context);
    try {
      await _apiPost(
        '/api/manager/refunds/${(widget.refund['id'] as num).toInt()}/decide',
        {'approve': approve, 'notes': _notes.text.trim()},
      );
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      navigator.pop(true);
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
    final r = widget.refund;
    final mq = MediaQuery.of(context);

    return _Sheet(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Refund on #${r['order_no'] ?? ''}', style: _title(21)),
            const SizedBox(height: 4),
            Text('Asked by ${r['requested_by_name'] ?? ''}',
                style: _txt(13, color: _mid)),
            const SizedBox(height: 16),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: _emberPale,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('AMOUNT TO REFUND',
                      style: _txt(11,
                          weight: FontWeight.w700, color: _ember)),
                  const SizedBox(height: 6),
                  Text(_ugx((r['amount'] as num?)?.toInt() ?? 0),
                      style: _title(24,
                          weight: FontWeight.w800, color: _ember)),
                  const SizedBox(height: 8),
                  Text(r['reason'] as String? ?? '',
                      style: _txt(13, color: _inkSoft, height: 1.45)),
                ],
              ),
            ),
            const SizedBox(height: 14),
            _Field(
              controller: _notes,
              hint: 'A note for the record (optional)',
              maxLines: 2,
              capitalisation: TextCapitalization.sentences,
            ),
            const SizedBox(height: 10),
            Text(
              'Approving takes this out of the cash book and tells the '
              'customer. It cannot be undone in the app.',
              style: _txt(12, color: _light, height: 1.45),
            ),
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
            const SizedBox(height: 18),
            Row(
              children: [
                Expanded(
                  child: _Pressable(
                    scale: 0.98,
                    onTap: _busy ? null : () => _decide(false),
                    child: Container(
                      height: 46,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: _tile,
                        borderRadius: BorderRadius.circular(25),
                        boxShadow: _cardShadow,
                      ),
                      child: Text('Decline',
                          style: _txt(14.5,
                              weight: FontWeight.w600, color: _inkSoft)),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _Pressable(
                    scale: 0.98,
                    onTap: _busy ? null : () => _decide(true),
                    child: Container(
                      height: 46,
                      alignment: Alignment.center,
                      decoration: _liquid(tint: _green, radius: 25),
                      child: _busy
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: _white),
                            )
                          : Text('Approve refund',
                              style: _txt(14.5,
                                  weight: FontWeight.w600, color: _white)),
                    ),
                  ),
                ),
              ],
            ),
            SizedBox(height: mq.padding.bottom + 4),
          ],
        ),
      ),
    );
  }
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
            _row('Signed in as', 'Manager'),
            _row('Shop', 'Al Hadeed Hardware'),
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
                height: 46,
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

/// Customers on credit: what is owed to the shop, what is late, and who
/// owes the most. Shows nothing when nobody buys on credit.
class _OwedCard extends StatefulWidget {
  const _OwedCard();

  @override
  State<_OwedCard> createState() => _OwedCardState();
}

class _OwedCardState extends State<_OwedCard> {
  Map<String, dynamic>? _d;

  @override
  void initState() {
    super.initState();
    _apiGet('/api/credit').then((r) {
      if (mounted) setState(() => _d = r);
    }).catchError((_) {});
  }

  int _n(Object? v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;

  @override
  Widget build(BuildContext context) {
    final s = (_d?['summary'] as Map?)?.cast<String, dynamic>();
    if (s == null || (_n(s['owed']) == 0 && _n(s['customers']) == 0)) {
      return const SizedBox.shrink();
    }
    final top = ((_d?['accounts'] as List?) ?? const [])
        .map((x) => (x as Map).cast<String, dynamic>())
        .where((a) => _n(a['owed']) > 0)
        .take(3)
        .toList();
    final max = top.isEmpty ? 1 : _n(top.first['owed']);
    Widget fig(String k, String v, Color c) => Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(k, style: _txt(11, color: _mid)),
              const SizedBox(height: 2),
              Text(v,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: _txt(14, weight: FontWeight.w800, color: c)),
            ],
          ),
        );
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: _cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Icon(Icons.account_balance_wallet_outlined,
                size: 17, color: _brand),
            const SizedBox(width: 6),
            Text('Credit customers', style: _title(14)),
            const Spacer(),
            Text('${_n(s['owing'])} owe', style: _txt(11.5, color: _mid)),
          ]),
          const SizedBox(height: 10),
          Row(children: [
            fig('Owed to the shop', _shortUgx(_n(s['owed'])), _ink),
            fig('Late', _shortUgx(_n(s['overdue'])),
                _n(s['overdue']) > 0 ? _ember : _green),
            fig('Paid in today', _shortUgx(_n(s['paidToday'])), _green),
          ]),
          if (top.isNotEmpty) const SizedBox(height: 10),
          for (final a in top)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(children: [
                SizedBox(
                  width: 90,
                  child: Text('${a['name']}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: _txt(12, color: _inkSoft)),
                ),
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(3),
                    child: LinearProgressIndicator(
                      value: _n(a['owed']) / max,
                      minHeight: 6,
                      backgroundColor: _hairline,
                      color: _n(a['overdue']) > 0 ? _ember : _lime,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text(_shortUgx(_n(a['owed'])),
                    style: _txt(12, weight: FontWeight.w700, color: _ink)),
              ]),
            ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  LOANS — who owes the shop, and taking a payment on a loan.
//
//  The same in al_hadeed_manager.dart and al_hadeed_staff.dart: the
//  manager opens it from Debts & books, the cashier from the Loans tab.
// ═══════════════════════════════════════════════════════════════

int _bn(Object? v) => v is num ? v.toInt() : int.tryParse('${v ?? ''}') ?? 0;

/// "27 Nov 2026" from "2026-11-27".
String _bDay(Object? iso) {
  final s = '${iso ?? ''}';
  if (s.length < 10) return '';
  const m = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  final mo = int.tryParse(s.substring(5, 7)) ?? 1;
  return '${int.tryParse(s.substring(8, 10)) ?? ''} ${m[(mo - 1).clamp(0, 11)]} ${s.substring(0, 4)}';
}

String _bToday() {
  final n = DateTime.now();
  return '${n.year}-${n.month.toString().padLeft(2, '0')}-${n.day.toString().padLeft(2, '0')}';
}

String _bMethod(Object? m) => switch ('${m ?? ''}') {
      'cash' => 'Cash',
      'mobile_money' => 'Mobile Money',
      'mtn_momo' => 'MTN MoMo',
      'airtel_money' => 'Airtel Money',
      'bank' => 'Bank',
      'cheque' => 'Cheque',
      'card' => 'Card',
      'credit' => 'On loan',
      final o => o,
    };

/// Paid, Partly paid, Unpaid, Overdue: one look everywhere.
(String, Color, Color) _bStatus(String s) => switch (s) {
      'paid' => ('Paid', _green, _greenPale),
      'part' => ('Partly paid', _blue, _bluePale),
      'overdue' => ('Overdue', _ember, _emberPale),
      _ => ('Unpaid', _amber, _amberPale),
    };

Widget _bPill(String label, Color fg, Color bg) => Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
      child: Text(label, style: _txt(10.5, weight: FontWeight.w800, color: fg)),
    );

/// A loan account's state in one word, coloured.
(String, Color, Color) _bLoanState(Map<String, dynamic> a) {
  final owed = _bn(a['owed']);
  final limit = _bn(a['limit']);
  if (a['status'] == 'hold') return ('Stopped', _ember, _emberPale);
  if (a['status'] == 'closed') return ('Closed', _mid, _tile);
  if (a['status'] == 'none') return ('No account', _mid, _tile);
  if (_bn(a['overdue']) > 0) return ('Late', _ember, _emberPale);
  if (owed > limit) return ('Over limit', _ember, _emberPale);
  if (limit > 0 && owed >= limit * 0.8) return ('Near limit', _amber, _amberPale);
  if (owed <= 0) return ('Nothing owed', _green, _greenPale);
  return ('Good', _green, _greenPale);
}

Widget _bChoice(List<(String, String)> options, String value,
        ValueChanged<String> onPick) =>
    Wrap(spacing: 6, runSpacing: 6, children: [
      for (final (k, l) in options)
        _Pressable(
          scale: 0.95,
          onTap: () => onPick(k),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 160),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: value == k ? _lime : _tile,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: value == k ? _lime : _hairline),
            ),
            child: Text(l,
                style: _txt(12.5,
                    weight: FontWeight.w700,
                    color: value == k ? _onLime : _inkSoft)),
          ),
        ),
    ]);

Widget _bButton(String label, VoidCallback? onTap,
        {bool busy = false, Color tint = _lime}) =>
    _Pressable(
      scale: 0.98,
      onTap: busy ? null : onTap,
      child: Opacity(
        opacity: onTap == null && !busy ? 0.45 : 1,
        child: Container(
          height: 46,
          alignment: Alignment.center,
          decoration: BoxDecoration(
              color: tint, borderRadius: BorderRadius.circular(23)),
          child: busy
              ? SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: tint == _lime ? _onLime : _white))
              : Text(label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: _txt(14.5,
                      weight: FontWeight.w700,
                      color: tint == _lime ? _onLime : _white)),
        ),
      ),
    );

String _bInitials(String name) {
  final w = name
      .trim()
      .split(RegExp(r'\s+'))
      .where((x) => x.isNotEmpty)
      .take(2)
      .toList();
  return w.isEmpty ? '?' : w.map((x) => x.characters.first.toUpperCase()).join();
}

Widget _bHead(String t, {String? trailing}) => Padding(
      padding: const EdgeInsets.fromLTRB(2, 16, 2, 8),
      child: Row(children: [
        Text(t, style: _txt(11.5, weight: FontWeight.w800, color: _light)),
        const Spacer(),
        if (trailing != null) Text(trailing, style: _txt(11.5, color: _mid)),
      ]),
    );

/// A tick box that reads as a sentence.
Widget _bTick(String label, bool on, VoidCallback onTap) => _Pressable(
      scale: 0.98,
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(children: [
          Icon(on ? Icons.check_box_rounded : Icons.check_box_outline_blank_rounded,
              size: 22, color: on ? _brand : _light),
          const SizedBox(width: 8),
          Expanded(child: Text(label, style: _txt(13, color: _ink))),
        ]),
      ),
    );

/// The dark loan card: what is owed against the limit.
Widget _bLoanCard(Map<String, dynamic> a) {
  final owed = _bn(a['owed']);
  final limit = _bn(a['limit']);
  final late = _bn(a['overdue']);
  final used = limit > 0 ? owed / limit : (owed > 0 ? 1.0 : 0.0);
  final (label, fg, bg) = _bLoanState(a);
  Widget fig(String k, String v, Color c) => Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(k, style: _txt(10.5, color: _white.withOpacity(0.6))),
          const SizedBox(height: 2),
          Text(v,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: _txt(13.5, weight: FontWeight.w800, color: c)),
        ]),
      );
  return Container(
    padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
    decoration: BoxDecoration(color: _navy, borderRadius: BorderRadius.circular(20)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Text('Loan account', style: _txt(12.5, weight: FontWeight.w700, color: _white.withOpacity(0.8))),
        const Spacer(),
        _bPill(label, fg, bg),
      ]),
      const SizedBox(height: 10),
      Text(owed < 0 ? 'Paid ahead' : 'Owes (debit)',
          style: _txt(11.5, color: _white.withOpacity(0.6))),
      Text(_ugx(owed.abs()), style: _title(27, weight: FontWeight.w800, color: _white)),
      const SizedBox(height: 12),
      ClipRRect(
        borderRadius: BorderRadius.circular(5),
        child: LinearProgressIndicator(
          value: used.clamp(0.0, 1.0).toDouble(),
          minHeight: 8,
          backgroundColor: _white.withOpacity(0.14),
          color: owed > limit
              ? _ember
              : used >= 0.8
                  ? const Color(0xFFE0A030)
                  : _lime,
        ),
      ),
      const SizedBox(height: 6),
      Text(
          limit > 0
              ? '${(used * 100).clamp(0, 999).round()}% of the ${_shortUgx(limit)} limit'
              : 'No limit set',
          style: _txt(11, color: _white.withOpacity(0.65))),
      const SizedBox(height: 12),
      Row(children: [
        fig('Left to use', _shortUgx(_bn(a['available'])), _lime),
        fig('Late', late > 0 ? _shortUgx(late) : 'Nothing',
            late > 0 ? const Color(0xFFFF8A80) : _lime),
        fig('Days to pay', '${_bn(a['termsDays'])}', _white),
      ]),
    ]),
  );
}

/// Everyone with a loan: search, filter, tap to see and take a payment.
class _LoansList extends StatefulWidget {
  const _LoansList({this.top = const [], this.summary = true});

  /// Shown above the list, inside the same scroll.
  final List<Widget> top;

  /// The three boxes of totals; off where the page already shows them.
  final bool summary;

  @override
  State<_LoansList> createState() => _LoansListState();
}

class _LoansListState extends State<_LoansList> {
  Map<String, dynamic>? _d;
  String? _error;
  String _show = 'owing';
  final _q = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final r = await _apiGet('/api/credit');
      if (mounted) setState(() {
        _d = r;
        _error = null;
      });
    } on _ApiError catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _open(Map<String, dynamic> a) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _LoanSheet(customerId: _bn(a['customerId']), name: '${a['name']}'),
    );
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final all = ((_d?['accounts'] as List?) ?? const [])
        .map((x) => (x as Map).cast<String, dynamic>())
        .toList();
    final s = (_d?['summary'] as Map?)?.cast<String, dynamic>();
    bool keep(Map<String, dynamic> a, String k) => switch (k) {
          'owing' => _bn(a['owed']) > 0,
          'late' => _bn(a['overdue']) > 0,
          _ => true,
        };
    final q = _q.text.trim().toLowerCase();
    final rows = all
        .where((a) => keep(a, _show))
        .where((a) => q.isEmpty || '${a['name']} ${a['phone']}'.toLowerCase().contains(q))
        .toList();

    return RefreshIndicator(
      color: _brand,
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 24),
        children: [
          ...widget.top,
          if (s != null && widget.summary) ...[
            Row(children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: _navy, borderRadius: BorderRadius.circular(16)),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Customers owe', style: _txt(11, color: _white.withOpacity(0.65))),
                    const SizedBox(height: 2),
                    Text(_shortUgx(_bn(s['owed'])), style: _title(19, weight: FontWeight.w800, color: _white)),
                    Text('${_bn(s['owing'])} customers', style: _txt(10.5, color: _white.withOpacity(0.6))),
                  ]),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: _bn(s['overdue']) > 0 ? _emberPale : _greenPale,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Late', style: _txt(11, color: _mid)),
                    const SizedBox(height: 2),
                    Text(_shortUgx(_bn(s['overdue'])),
                        style: _title(19, weight: FontWeight.w800, color: _bn(s['overdue']) > 0 ? _ember : _green)),
                    Text('${_bn(s['overdueCount'])} past their days', style: _txt(10.5, color: _mid)),
                  ]),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: _white, borderRadius: BorderRadius.circular(16), border: Border.all(color: _hairline)),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Paid in today', style: _txt(11, color: _mid)),
                    const SizedBox(height: 2),
                    Text(_shortUgx(_bn(s['paidToday'])), style: _title(19, weight: FontWeight.w800, color: _green)),
                    Text('${_shortUgx(_bn(s['soldToday']))} sold on loan', style: _txt(10.5, color: _mid)),
                  ]),
                ),
              ),
            ]),
            const SizedBox(height: 12),
          ],
          _Field(
            controller: _q,
            hint: 'Search name or phone',
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 10),
          _bChoice([
            ('owing', 'Owing ${all.where((a) => keep(a, 'owing')).length}'),
            ('late', 'Late ${all.where((a) => keep(a, 'late')).length}'),
            ('all', 'All ${all.length}'),
          ], _show, (v) => setState(() => _show = v)),
          const SizedBox(height: 10),
          if (_d == null && _error == null)
            const Padding(
              padding: EdgeInsets.all(30),
              child: Center(child: CircularProgressIndicator(color: _brand)),
            ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Text(_error!, style: _txt(13, color: _ember)),
            ),
          if (_d != null && rows.isEmpty)
            _Empty(
              icon: Icons.account_balance_wallet_outlined,
              title: all.isEmpty ? 'No loans yet' : 'Nobody here',
              line: all.isEmpty ? 'The manager opens loans on the panel.' : 'Try another filter.',
            ),
          for (final (i, a) in rows.indexed) _rise(_row(a), i),
        ],
      ),
    );
  }

  Widget _row(Map<String, dynamic> a) {
    final owed = _bn(a['owed']);
    final limit = _bn(a['limit']);
    final (label, fg, bg) = _bLoanState(a);
    final used = limit > 0 ? (owed / limit).clamp(0.0, 1.0).toDouble() : 0.0;
    return _Pressable(
      scale: 0.98,
      onTap: () => _open(a),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: _white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: _bn(a['overdue']) > 0 ? _ember.withOpacity(0.3) : _hairline),
        ),
        child: Row(children: [
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
            child: Text(_bInitials('${a['name']}'),
                style: _txt(13, weight: FontWeight.w800, color: fg)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(
                  child: Text('${a['name']}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: _txt(13.5, weight: FontWeight.w700, color: _ink)),
                ),
                Text(owed < 0 ? '+${_shortUgx(-owed)}' : _ugx(owed),
                    style: _txt(13.5, weight: FontWeight.w800, color: owed < 0 ? _green : _ink)),
              ]),
              const SizedBox(height: 5),
              ClipRRect(
                borderRadius: BorderRadius.circular(3),
                child: LinearProgressIndicator(
                  value: used,
                  minHeight: 5,
                  backgroundColor: _hairline,
                  color: owed > limit || _bn(a['overdue']) > 0 ? _ember : used >= 0.8 ? _amber : _lime,
                ),
              ),
              const SizedBox(height: 5),
              Row(children: [
                Expanded(
                  child: Text(
                      [
                        if (limit > 0) 'Limit ${_shortUgx(limit)}',
                        if (_bn(a['overdue']) > 0) '${_shortUgx(_bn(a['overdue']))} late',
                        if (a['nextDue'] != null && _bn(a['overdue']) == 0) 'Due ${_bDay(a['nextDue'])}',
                      ].join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: _txt(11, color: _mid)),
                ),
                _bPill(label, fg, bg),
              ]),
            ]),
          ),
        ]),
      ),
    );
  }
}

/// One customer's loan: the card, bills not paid, every line, and
/// taking a payment.
class _LoanSheet extends StatefulWidget {
  const _LoanSheet({required this.customerId, required this.name});
  final int customerId;
  final String name;

  @override
  State<_LoanSheet> createState() => _LoanSheetState();
}

class _LoanSheetState extends State<_LoanSheet> {
  Map<String, dynamic>? _d;
  String? _error;
  bool _taking = false;
  final _amount = TextEditingController();
  final _ref = TextEditingController();
  final _note = TextEditingController();
  String _how = 'cash';
  bool _busy = false;
  String? _formError;
  String? _done;
  bool _twice = false;
  bool _again = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _amount.dispose();
    _ref.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final r = await _apiGet('/api/credit/${widget.customerId}');
      if (mounted) setState(() => _d = r);
    } on _ApiError catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  int get _n => _bn(_amount.text.replaceAll(RegExp(r'[^0-9]'), ''));

  Future<void> _pay() async {
    setState(() {
      _busy = true;
      _formError = null;
    });
    try {
      final r = await _apiPost('/api/credit/${widget.customerId}/payment', {
        'amount': _n,
        'method': _how,
        'ref': _how == 'cash' ? '' : _ref.text.trim(),
        'note': _note.text.trim(),
        'again': _again,
      });
      HapticFeedback.mediumImpact();
      if (!mounted) return;
      final left = _bn((r['account'] as Map?)?['owed']);
      setState(() {
        _d = r;
        _busy = false;
        _taking = false;
        _twice = false;
        _again = false;
        _done = 'Received ${_ugx(_n)}. Receipt ${r['receiptNo']}. '
            '${left > 0 ? 'Now owes ${_ugx(left)}.' : left < 0 ? 'Owes nothing, ${_ugx(-left)} paid ahead.' : 'Owes nothing now.'}';
        _amount.clear();
        _ref.clear();
        _note.clear();
      });
    } on _ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _formError = e.message;
        if (e.code == 'ah_paid_twice') _twice = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = (_d?['account'] as Map?)?.cast<String, dynamic>();
    final bills = ((_d?['bills'] as List?) ?? const [])
        .map((x) => (x as Map).cast<String, dynamic>())
        .toList();
    final lines = ((_d?['statement'] as List?) ?? const [])
        .map((x) => (x as Map).cast<String, dynamic>())
        .toList();
    final today = _bToday();

    return _Sheet(
      child: Padding(
        padding: EdgeInsets.fromLTRB(16, 4, 16, MediaQuery.paddingOf(context).bottom + 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(children: [
              Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: const BoxDecoration(color: _lime, shape: BoxShape.circle),
                child: Text(_bInitials(widget.name),
                    style: _title(15, weight: FontWeight.w800, color: _onLime)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(widget.name, style: _title(18, weight: FontWeight.w800)),
                  if ('${a?['phone'] ?? ''}'.isNotEmpty)
                    Text('${a!['phone']}', style: _txt(12, color: _mid)),
                ]),
              ),
            ]),
            const SizedBox(height: 12),
            if (_d == null && _error == null)
              const Padding(
                padding: EdgeInsets.all(30),
                child: Center(child: CircularProgressIndicator(color: _brand)),
              ),
            if (_error != null) Text(_error!, style: _txt(13, color: _ember)),
            if (a != null) ...[
              _bLoanCard(a),
              if (_done != null) ...[
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: _greenPale, borderRadius: BorderRadius.circular(14)),
                  child: Row(children: [
                    const Icon(Icons.check_circle_rounded, size: 20, color: _green),
                    const SizedBox(width: 8),
                    Expanded(child: Text(_done!, style: _txt(12.5, weight: FontWeight.w600, color: _green))),
                  ]),
                ),
              ],
              if ('${a['blocked'] ?? ''}'.isNotEmpty && _bn(a['owed']) > 0) ...[
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: _emberPale, borderRadius: BorderRadius.circular(14)),
                  child: Text('${a['blocked']}', style: _txt(12.5, weight: FontWeight.w600, color: _ember)),
                ),
              ],
              const SizedBox(height: 12),
              if (!_taking)
                _bButton('Take a payment', () => setState(() {
                      _taking = true;
                      _done = null;
                    }))
              else
                _payForm(a),
              if (bills.isNotEmpty) ...[
                _bHead('BILLS NOT YET PAID', trailing: 'oldest paid first'),
                for (final b in bills)
                  Container(
                    margin: const EdgeInsets.only(bottom: 6),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                    decoration: BoxDecoration(
                      color: _white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: '${b['due']}'.compareTo(today) < 0 ? _ember.withOpacity(0.4) : _hairline),
                    ),
                    child: Row(children: [
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('${_bDay(b['date'])}${b['ref'] != null ? ' · ${b['ref']}' : ''}',
                              style: _txt(12.5, weight: FontWeight.w700, color: _ink)),
                          Text(
                              '${b['due']}'.compareTo(today) < 0
                                  ? 'Late since ${_bDay(b['due'])}'
                                  : 'Pay by ${_bDay(b['due'])}',
                              style: _txt(11.5, color: '${b['due']}'.compareTo(today) < 0 ? _ember : _mid)),
                        ]),
                      ),
                      Text(_ugx(_bn(b['left'])), style: _txt(13, weight: FontWeight.w800, color: _ink)),
                    ]),
                  ),
              ],
              if (lines.isNotEmpty) ...[
                _bHead('LATEST', trailing: '${lines.length} lines'),
                Container(
                  decoration: BoxDecoration(
                    color: _white,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: _cardShadow,
                  ),
                  child: Column(children: [
                    for (var i = 0; i < lines.length && i < 12; i++) _line(lines[i], i > 0),
                  ]),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }

  Widget _payForm(Map<String, dynamic> a) {
    final owed = _bn(a['owed']);
    final late = _bn(a['overdue']);
    final quick = <(String, int)>[
      if (owed > 0) ('All', owed),
      if (late > 0 && late != owed) ('Late part', late),
      if (owed > 1) ('Half', (owed / 2).round()),
    ];
    final ok = !_busy && _n > 0 && (_how == 'cash' || _ref.text.trim().length >= 3);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: _cardShadow,
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Text('Payment', style: _title(16, weight: FontWeight.w800)),
          const Spacer(),
          GestureDetector(
            onTap: () => setState(() => _taking = false),
            child: Text('Cancel', style: _txt(13, weight: FontWeight.w700, color: _mid)),
          ),
        ]),
        const SizedBox(height: 10),
        _Field(
          controller: _amount,
          hint: 'Amount paid (UGX)',
          keyboardType: TextInputType.number,
          autofocus: true,
          onChanged: (_) => setState(() {}),
        ),
        if (quick.isNotEmpty) ...[
          const SizedBox(height: 8),
          Wrap(spacing: 6, runSpacing: 6, children: [
            for (final (k, v) in quick)
              _Pressable(
                scale: 0.95,
                onTap: () => setState(() => _amount.text = '$v'),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: _brandPale,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text('$k · ${_shortUgx(v)}',
                      style: _txt(11.5, weight: FontWeight.w700, color: _brandDark)),
                ),
              ),
          ]),
        ],
        const SizedBox(height: 12),
        Text('How did they pay?', style: _txt(12.5, weight: FontWeight.w700, color: _mid)),
        const SizedBox(height: 6),
        _bChoice(const [
          ('cash', 'Cash'),
          ('mobile_money', 'Mobile Money'),
          ('bank', 'Bank'),
          ('cheque', 'Cheque'),
        ], _how, (v) => setState(() => _how = v)),
        if (_how != 'cash') ...[
          const SizedBox(height: 10),
          _Field(
            controller: _ref,
            hint: _how == 'cheque' ? 'Cheque number' : 'Transaction ID',
            capitalisation: TextCapitalization.characters,
            onChanged: (_) => setState(() {}),
          ),
        ],
        const SizedBox(height: 10),
        _Field(controller: _note, hint: 'Note (optional)'),
        if (_n > 0) ...[
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(color: _tile, borderRadius: BorderRadius.circular(12)),
            child: Text(
                owed - _n >= 0
                    ? 'After this they owe ${_ugx(owed - _n)}.'
                    : 'They owe nothing, and ${_ugx(_n - owed)} is kept for their next loan order.',
                style: _txt(12.5, color: _inkSoft)),
          ),
        ],
        if (_formError != null) ...[
          const SizedBox(height: 10),
          Text(_formError!, style: _txt(12.5, color: _ember, height: 1.4)),
        ],
        if (_twice)
          _bTick('It is a second payment, not the same one again', _again,
              () => setState(() => _again = !_again)),
        const SizedBox(height: 12),
        _bButton(_n > 0 ? 'Receive ${_ugx(_n)}' : 'Type the amount', ok ? _pay : null, busy: _busy),
        const SizedBox(height: 6),
        Text('A receipt is made and it goes in the cash book. The customer gets an SMS.',
            textAlign: TextAlign.center, style: _txt(11, color: _mid)),
      ]),
    );
  }

  Widget _line(Map<String, dynamic> l, bool rule) {
    final paid = _bn(l['credit']) > 0;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        border: rule ? const Border(top: BorderSide(color: _hairline)) : null,
      ),
      child: Row(children: [
        Container(
          width: 30,
          height: 30,
          decoration: BoxDecoration(color: paid ? _greenPale : _amberPale, shape: BoxShape.circle),
          child: Icon(paid ? Icons.south_west_rounded : Icons.north_east_rounded,
              size: 14, color: paid ? _green : _amber),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${l['what']}', style: _txt(12.5, weight: FontWeight.w700, color: _ink)),
            Text(
                [
                  _bDay(l['date']),
                  if (l['orderNo'] != null) '${l['orderNo']}',
                  if (l['ref'] != null) '${l['ref']}',
                  if ('${l['by'] ?? ''}'.isNotEmpty) '${l['by']}',
                ].join(' · '),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: _txt(10.5, color: _mid)),
          ]),
        ),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Text(paid ? '-${_ugx(_bn(l['credit']))}' : '+${_ugx(_bn(l['debit']))}',
              style: _txt(12.5, weight: FontWeight.w800, color: paid ? _green : _ink)),
          Text('Owed ${_shortUgx(_bn(l['balance']))}', style: _txt(10, color: _light)),
        ]),
      ]),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  DEBTS & BOOKS — the manager's view of money owed, both ways.
// ═══════════════════════════════════════════════════════════════

/// On the home screen: who owes the shop, whom the shop owes, and that
/// the books add up. Tap to open the whole page.
class _BooksCard extends StatefulWidget {
  const _BooksCard();

  @override
  State<_BooksCard> createState() => _BooksCardState();
}

class _BooksCardState extends State<_BooksCard> {
  Map<String, dynamic>? _d;
  bool _old = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await _apiGet('/api/manager/books');
      if (mounted) setState(() => _d = r);
    } on _ApiError {
      // An older shop has no books yet: say nothing rather than fail.
      if (mounted) setState(() => _old = true);
    }
  }

  Future<void> _open() async {
    await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const _BooksPage()));
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_old) return const SizedBox.shrink();
    final d = _d;
    if (d == null) {
      return const Padding(
        padding: EdgeInsets.only(bottom: 14),
        child: _Skeleton(0, 150, radius: 18),
      );
    }
    final t = (d['today'] as Map?)?.cast<String, dynamic>() ?? {};
    final ok = (d['check'] as Map?)?['balanced'] == true;
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: _Pressable(
        scale: 0.99,
        onTap: _open,
        child: Container(
          decoration: BoxDecoration(
            color: _white,
            borderRadius: BorderRadius.circular(18),
            boxShadow: _cardShadow,
          ),
          child: Column(children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 10, 0),
              child: Row(children: [
                const Icon(Icons.account_balance_rounded, size: 18, color: _brand),
                const SizedBox(width: 7),
                Text('Debts & books', style: _title(14.5, weight: FontWeight.w800)),
                const SizedBox(width: 8),
                _bPill(ok ? 'Books add up' : 'Check the books', ok ? _green : _ember, ok ? _greenPale : _emberPale),
                const Spacer(),
                Text('Open', style: _txt(12, weight: FontWeight.w700, color: _brand)),
                const Icon(Icons.chevron_right_rounded, size: 18, color: _brand),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.all(10),
              child: Row(children: [
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: _navy, borderRadius: BorderRadius.circular(14)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Customers owe us', style: _txt(11, color: _white.withOpacity(0.65))),
                      const SizedBox(height: 3),
                      Text(_shortUgx(_bn(d['receivable'])), style: _title(20, weight: FontWeight.w800, color: _white)),
                      const SizedBox(height: 3),
                      Text(_bn(d['overdueIn']) > 0 ? '${_shortUgx(_bn(d['overdueIn']))} late' : 'Nothing late',
                          style: _txt(11, weight: FontWeight.w700,
                              color: _bn(d['overdueIn']) > 0 ? const Color(0xFFFF8A80) : _lime)),
                    ]),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: _amberPale, borderRadius: BorderRadius.circular(14)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('We owe suppliers', style: _txt(11, color: _mid)),
                      const SizedBox(height: 3),
                      Text(_shortUgx(_bn(d['payable'])), style: _title(20, weight: FontWeight.w800, color: _ink)),
                      const SizedBox(height: 3),
                      Text(_bn(d['overdueOut']) > 0 ? '${_shortUgx(_bn(d['overdueOut']))} late' : '${_bList(d['upcoming']).length} bills due soon',
                          style: _txt(11, weight: FontWeight.w700, color: _bn(d['overdueOut']) > 0 ? _ember : _amber)),
                    ]),
                  ),
                ),
              ]),
            ),
            Container(
              padding: const EdgeInsets.fromLTRB(14, 9, 14, 11),
              decoration: const BoxDecoration(border: Border(top: BorderSide(color: _hairline))),
              child: Row(children: [
                Expanded(child: Text('Today: ${_shortUgx(_bn(t['creditSales']))} on loan', style: _txt(11.5, color: _mid))),
                Text('${_shortUgx(_bn(t['collections']))} paid in', style: _txt(11.5, weight: FontWeight.w700, color: _green)),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

List<dynamic> _bList(Object? v) => v is List ? v : const [];

/// The whole page: both debts, today, and the lists.
class _BooksPage extends StatefulWidget {
  const _BooksPage();

  @override
  State<_BooksPage> createState() => _BooksPageState();
}

class _BooksPageState extends State<_BooksPage> {
  Map<String, dynamic>? _d;
  String? _error;
  String _tab = 'customers';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await _apiGet('/api/manager/books');
      if (mounted) setState(() {
        _d = r;
        _error = null;
      });
    } on _ApiError catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  List<Widget> get _top {
    final d = _d;
    if (d == null) {
      return [
        if (_error != null) Text(_error!, style: _txt(13, color: _ember)),
        if (_error == null)
          const Padding(
            padding: EdgeInsets.all(30),
            child: Center(child: CircularProgressIndicator(color: _brand)),
          ),
      ];
    }
    final t = (d['today'] as Map?)?.cast<String, dynamic>() ?? {};
    Widget today(String k, int v, IconData icon, Color c) => Expanded(
          child: Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: _white,
              borderRadius: BorderRadius.circular(14),
              boxShadow: _cardShadow,
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(icon, size: 16, color: c),
              const SizedBox(height: 5),
              Text(_shortUgx(v), maxLines: 1, style: _txt(13.5, weight: FontWeight.w800, color: _ink)),
              Text(k, maxLines: 2, style: _txt(10, color: _mid, height: 1.2)),
            ]),
          ),
        );
    return [
      // Both debts, side by side.
      Row(children: [
        Expanded(
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: _navy, borderRadius: BorderRadius.circular(18)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Icon(Icons.south_west_rounded, size: 15, color: _lime),
                const SizedBox(width: 5),
                Text('Customers owe us', style: _txt(11.5, color: _white.withOpacity(0.7))),
              ]),
              const SizedBox(height: 6),
              Text(_shortUgx(_bn(d['receivable'])), style: _title(22, weight: FontWeight.w800, color: _white)),
              Text('${_bn(d['debtors'])} customers', style: _txt(11, color: _white.withOpacity(0.6))),
              const SizedBox(height: 8),
              _bPill(_bn(d['overdueIn']) > 0 ? '${_shortUgx(_bn(d['overdueIn']))} late' : 'Nothing late',
                  _bn(d['overdueIn']) > 0 ? _ember : _green, _bn(d['overdueIn']) > 0 ? _emberPale : _greenPale),
            ]),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: _white,
              borderRadius: BorderRadius.circular(18),
              boxShadow: _cardShadow,
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                const Icon(Icons.north_east_rounded, size: 15, color: _amber),
                const SizedBox(width: 5),
                Text('We owe suppliers', style: _txt(11.5, color: _mid)),
              ]),
              const SizedBox(height: 6),
              Text(_shortUgx(_bn(d['payable'])), style: _title(22, weight: FontWeight.w800, color: _ink)),
              Text('${_bn(d['creditors'])} suppliers', style: _txt(11, color: _mid)),
              const SizedBox(height: 8),
              _bPill(_bn(d['overdueOut']) > 0 ? '${_shortUgx(_bn(d['overdueOut']))} late' : 'Nothing late',
                  _bn(d['overdueOut']) > 0 ? _ember : _green, _bn(d['overdueOut']) > 0 ? _emberPale : _greenPale),
            ]),
          ),
        ),
      ]),
      _bHead('TODAY'),
      Row(children: [
        today('Sold on loan', _bn(t['creditSales']), Icons.receipt_long_rounded, _amber),
        const SizedBox(width: 6),
        today('Loan payments in', _bn(t['collections']), Icons.south_west_rounded, _green),
        const SizedBox(width: 6),
        today('Cash sales', _bn(t['cashSales']), Icons.payments_rounded, _brand),
        const SizedBox(width: 6),
        today('Paid to suppliers', _bn(t['supplierPayments']), Icons.north_east_rounded, _ember),
      ]),
      const SizedBox(height: 14),
      _bChoice(const [
        ('customers', 'Customers owe us'),
        ('suppliers', 'We owe suppliers'),
        ('due', 'Due & books'),
      ], _tab, (v) => setState(() => _tab = v)),
      const SizedBox(height: 12),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    _ui = (mq.size.width / 390).clamp(0.86, 1.08);
    final ok = (_d?['check'] as Map?)?['balanced'] == true;
    return Scaffold(
      backgroundColor: _bg,
      body: Column(children: [
        Container(
          width: double.infinity,
          decoration: const BoxDecoration(
            color: _lime,
            borderRadius: BorderRadius.vertical(bottom: Radius.circular(26)),
          ),
          padding: EdgeInsets.fromLTRB(8, mq.padding.top + 8, 14, 14),
          child: Row(children: [
            IconButton(
              onPressed: () => Navigator.of(context).pop(),
              icon: const Icon(Icons.arrow_back_rounded, color: _onLime),
            ),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Debts & books', style: _title(18, weight: FontWeight.w800, color: _onLime)),
                Text('Who owes us, whom we owe', style: _txt(12, color: _onLime.withOpacity(0.85))),
              ]),
            ),
            if (_d != null) _bPill(ok ? 'Books add up' : 'Not balanced', ok ? _green : _ember, _white),
          ]),
        ),
        Expanded(
          child: KeyedSubtree(
            key: ValueKey('$_tab ${_d != null}'),
            child: switch (_tab) {
              'customers' => _LoansList(top: _top, summary: false),
              'suppliers' => _SupplierList(top: _top),
              _ => _dueTab(),
            },
          ),
        ),
      ]),
    );
  }

  Widget _dueTab() {
    final d = _d;
    final c = (d?['check'] as Map?)?.cast<String, dynamic>() ?? {};
    final up = _bList(d?['upcoming']).map((x) => (x as Map).cast<String, dynamic>()).toList();
    final late = _bList(d?['overdueCustomers']).map((x) => (x as Map).cast<String, dynamic>()).toList();
    Widget row(String k, String v, {bool? good}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 5),
          child: Row(children: [
            Expanded(child: Text(k, style: _txt(12.5, color: _inkSoft))),
            Text(v, style: _txt(12.5, weight: FontWeight.w700, color: _ink)),
            if (good != null) ...[
              const SizedBox(width: 6),
              Icon(good ? Icons.check_circle_rounded : Icons.error_rounded, size: 16, color: good ? _green : _ember),
            ],
          ]),
        );
    return RefreshIndicator(
      color: _brand,
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 24),
        children: [
          ..._top,
          _bHead('SUPPLIER BILLS DUE IN 14 DAYS'),
          if (up.isEmpty)
            Text('Nothing due soon.', style: _txt(12.5, color: _mid))
          else
            for (final b in up)
              _Pressable(
                scale: 0.98,
                onTap: () async {
                  await showModalBottomSheet<void>(
                    context: context,
                    isScrollControlled: true,
                    useSafeArea: true,
                    backgroundColor: Colors.transparent,
                    builder: (_) => _SupplierSheet(name: '${b['supplier']}'),
                  );
                  await _load();
                },
                child: Container(
                  margin: const EdgeInsets.only(bottom: 6),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: _white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: b['late'] == true ? _ember.withOpacity(0.35) : _hairline),
                  ),
                  child: Row(children: [
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('${b['supplier']}', style: _txt(13, weight: FontWeight.w700, color: _ink)),
                        Text('${b['invoice']} · ${b['late'] == true ? 'Late since' : 'Due'} ${_bDay(b['due'])}',
                            style: _txt(11.5, color: b['late'] == true ? _ember : _mid)),
                      ]),
                    ),
                    Text(_ugx(_bn(b['owed'])), style: _txt(13, weight: FontWeight.w800, color: _ink)),
                  ]),
                ),
              ),
          _bHead('LATE CUSTOMERS'),
          if (late.isEmpty)
            Text('Nobody is late.', style: _txt(12.5, color: _mid))
          else
            for (final a in late)
              _Pressable(
                scale: 0.98,
                onTap: () async {
                  await showModalBottomSheet<void>(
                    context: context,
                    isScrollControlled: true,
                    useSafeArea: true,
                    backgroundColor: Colors.transparent,
                    builder: (_) => _LoanSheet(customerId: _bn(a['customerId']), name: '${a['name']}'),
                  );
                  await _load();
                },
                child: Container(
                  margin: const EdgeInsets.only(bottom: 6),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: _white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: _ember.withOpacity(0.3)),
                  ),
                  child: Row(children: [
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('${a['name']}', style: _txt(13, weight: FontWeight.w700, color: _ink)),
                        Text('${a['phone'] ?? ''} · oldest bill ${_bn(a['oldestDays'])} days',
                            style: _txt(11.5, color: _mid)),
                      ]),
                    ),
                    Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                      Text(_ugx(_bn(a['overdue'])), style: _txt(13, weight: FontWeight.w800, color: _ember)),
                      Text('of ${_shortUgx(_bn(a['owed']))}', style: _txt(10.5, color: _mid)),
                    ]),
                  ]),
                ),
              ),
          _bHead('THE BOOKS ADD UP'),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: _white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: _cardShadow,
            ),
            child: Column(children: [
              row('All debits', _ugx(_bn(c['debit']))),
              row('All credits', _ugx(_bn(c['credit'])), good: c['balanced'] == true),
              row('Customers owe, books / list', '${_shortUgx(_bn(c['receivableBooks']))} / ${_shortUgx(_bn(c['receivableList']))}',
                  good: _bn(c['receivableBooks']) == _bn(c['receivableList'])),
              row('We owe, books / bills', '${_shortUgx(_bn(c['payableBooks']))} / ${_shortUgx(_bn(c['payableList']))}',
                  good: _bn(c['payableBooks']) == _bn(c['payableList'])),
              const Divider(height: 14, color: _hairline),
              row('Cash', _ugx(_bn(c['cash']))),
              row('Mobile money', _ugx(_bn(c['mobile']))),
              row('Bank', _ugx(_bn(c['bank']))),
              row('Stock at cost', _ugx(_bn(c['stock']))),
            ]),
          ),
          const SizedBox(height: 8),
          Text('Reports, the journal and Excel are on the web panel under Debts & books.',
              style: _txt(11.5, color: _mid)),
        ],
      ),
    );
  }
}

/// Every supplier the shop owes.
class _SupplierList extends StatefulWidget {
  const _SupplierList({this.top = const []});
  final List<Widget> top;

  @override
  State<_SupplierList> createState() => _SupplierListState();
}

class _SupplierListState extends State<_SupplierList> {
  List<Map<String, dynamic>>? _rows;
  String? _error;
  String _show = 'owe';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await _apiGet('/api/manager/books/report?type=creditors');
      if (mounted) setState(() {
        _rows = _bList(r['rows']).map((x) => (x as Map).cast<String, dynamic>()).toList();
        _error = null;
      });
    } on _ApiError catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final all = _rows ?? const <Map<String, dynamic>>[];
    bool keep(Map<String, dynamic> r, String k) => switch (k) {
          'owe' => _bn(r['owed']) > 0,
          'late' => _bn(r['overdue']) > 0,
          _ => true,
        };
    final rows = all.where((r) => keep(r, _show)).toList();
    return RefreshIndicator(
      color: _brand,
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 24),
        children: [
          ...widget.top,
          _bChoice([
            ('owe', 'We owe ${all.where((r) => keep(r, 'owe')).length}'),
            ('late', 'Late ${all.where((r) => keep(r, 'late')).length}'),
            ('all', 'All ${all.length}'),
          ], _show, (v) => setState(() => _show = v)),
          const SizedBox(height: 10),
          if (_rows == null && _error == null)
            const Padding(
              padding: EdgeInsets.all(30),
              child: Center(child: CircularProgressIndicator(color: _brand)),
            ),
          if (_error != null) Text(_error!, style: _txt(13, color: _ember)),
          if (_rows != null && rows.isEmpty)
            const _Empty(
              icon: Icons.local_shipping_outlined,
              title: 'Nothing owed',
              line: 'Supplier bills are added under Buying on the panel.',
            ),
          for (final (i, r) in rows.indexed) _rise(_row(r), i),
        ],
      ),
    );
  }

  Widget _row(Map<String, dynamic> r) {
    final billed = _bn(r['billed']);
    final paid = _bn(r['paid']) + _bn(r['credits']);
    final (label, fg, bg) = _bStatus('${r['status']}');
    return _Pressable(
      scale: 0.98,
      onTap: () async {
        await showModalBottomSheet<void>(
          context: context,
          isScrollControlled: true,
          useSafeArea: true,
          backgroundColor: Colors.transparent,
          builder: (_) => _SupplierSheet(name: '${r['supplier']}'),
        );
        await _load();
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: _white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: _bn(r['overdue']) > 0 ? _ember.withOpacity(0.3) : _hairline),
        ),
        child: Row(children: [
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: _amberPale, borderRadius: BorderRadius.circular(12)),
            child: const Icon(Icons.local_shipping_rounded, size: 19, color: _amber),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(
                  child: Text('${r['supplier']}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: _txt(13.5, weight: FontWeight.w700, color: _ink)),
                ),
                Text(_ugx(_bn(r['owed'])), style: _txt(13.5, weight: FontWeight.w800, color: _ink)),
              ]),
              const SizedBox(height: 5),
              ClipRRect(
                borderRadius: BorderRadius.circular(3),
                child: LinearProgressIndicator(
                  value: billed > 0 ? (paid / billed).clamp(0.0, 1.0).toDouble() : 1,
                  minHeight: 5,
                  backgroundColor: _hairline,
                  color: _green,
                ),
              ),
              const SizedBox(height: 5),
              Row(children: [
                Expanded(
                  child: Text(
                      [
                        'Paid ${_shortUgx(paid)} of ${_shortUgx(billed)}',
                        if (_bn(r['overdue']) > 0) '${_shortUgx(_bn(r['overdue']))} late'
                        else if (r['nextDue'] != null) 'due ${_bDay(r['nextDue'])}',
                      ].join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: _txt(11, color: _mid)),
                ),
                _bPill(label, fg, bg),
              ]),
            ]),
          ),
        ]),
      ),
    );
  }
}

/// One supplier: what is owed, the bills to pay (each payable here), and
/// the statement.
class _SupplierSheet extends StatefulWidget {
  const _SupplierSheet({required this.name});
  final String name;

  @override
  State<_SupplierSheet> createState() => _SupplierSheetState();
}

class _SupplierSheetState extends State<_SupplierSheet> {
  Map<String, dynamic>? _d;
  String? _error;
  int? _paying;
  final _amount = TextEditingController();
  final _ref = TextEditingController();
  String _how = 'bank';
  bool _busy = false;
  String? _formError;
  String? _done;
  bool _twice = false;
  bool _again = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _amount.dispose();
    _ref.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final r = await _apiGet('/api/manager/books/supplier?name=${Uri.encodeQueryComponent(widget.name)}');
      if (mounted) setState(() => _d = r);
    } on _ApiError catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  int get _n => _bn(_amount.text.replaceAll(RegExp(r'[^0-9]'), ''));

  Future<void> _pay(Map<String, dynamic> bill) async {
    setState(() {
      _busy = true;
      _formError = null;
    });
    try {
      await _apiPost('/api/manager/supplier-bills/${_bn(bill['billId'])}/pay', {
        'amount': _n,
        'method': _how,
        'ref': _how == 'cash' ? '' : _ref.text.trim(),
        'date': _bToday(),
        'again': _again,
      });
      HapticFeedback.mediumImpact();
      if (!mounted) return;
      setState(() {
        _busy = false;
        _paying = null;
        _twice = false;
        _again = false;
        _done = 'Paid ${_ugx(_n)} on ${bill['ref']}.';
        _amount.clear();
        _ref.clear();
      });
      await _load();
    } on _ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _formError = e.message;
        if (e.code == 'ah_paid_twice') _twice = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = (_d?['account'] as Map?)?.cast<String, dynamic>();
    final lines = _bList(_d?['lines']).map((x) => (x as Map).cast<String, dynamic>()).toList();
    final open = lines.where((l) => l['billId'] != null && _bn(l['left']) > 0).toList()
      ..sort((x, y) => '${x['due'] ?? x['date']}'.compareTo('${y['due'] ?? y['date']}'));
    final today = _bToday();
    Widget fig(String k, int v, Color c) => Expanded(
          child: Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: _tile, borderRadius: BorderRadius.circular(12), border: Border.all(color: _hairline)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(k, style: _txt(10.5, color: _mid)),
              const SizedBox(height: 2),
              Text(_shortUgx(v), maxLines: 1, style: _txt(13.5, weight: FontWeight.w800, color: c)),
            ]),
          ),
        );

    return _Sheet(
      child: Padding(
        padding: EdgeInsets.fromLTRB(16, 4, 16, MediaQuery.paddingOf(context).bottom + 20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(color: _amberPale, borderRadius: BorderRadius.circular(14)),
              child: const Icon(Icons.local_shipping_rounded, size: 21, color: _amber),
            ),
            const SizedBox(width: 10),
            Expanded(child: Text(widget.name, style: _title(18, weight: FontWeight.w800))),
            if (a != null) ...[
              () {
                final (l, fg, bg) = _bStatus('${a['status']}');
                return _bPill(l, fg, bg);
              }(),
            ],
          ]),
          const SizedBox(height: 12),
          if (_d == null && _error == null)
            const Padding(
              padding: EdgeInsets.all(30),
              child: Center(child: CircularProgressIndicator(color: _brand)),
            ),
          if (_error != null) Text(_error!, style: _txt(13, color: _ember)),
          if (a != null)
            Row(children: [
              fig('We owe', _bn(a['owed']), _ink),
              const SizedBox(width: 6),
              fig('Late', _bn(a['overdue']), _bn(a['overdue']) > 0 ? _ember : _green),
              const SizedBox(width: 6),
              fig('Billed', _bn(a['billed']), _ink),
              const SizedBox(width: 6),
              fig('Paid', _bn(a['paid']) + _bn(a['credits']), _green),
            ]),
          if (_done != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: _greenPale, borderRadius: BorderRadius.circular(14)),
              child: Text(_done!, style: _txt(12.5, weight: FontWeight.w600, color: _green)),
            ),
          ],
          if (open.isNotEmpty) ...[
            _bHead('BILLS TO PAY', trailing: '${open.length}'),
            for (final b in open) _bill(b, today),
          ],
          if (lines.isNotEmpty) ...[
            _bHead('STATEMENT', trailing: 'newest first'),
            Container(
              decoration: BoxDecoration(
                color: _white,
                borderRadius: BorderRadius.circular(14),
                boxShadow: _cardShadow,
              ),
              child: Column(children: [
                for (var i = 0; i < lines.length && i < 20; i++)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                    decoration: BoxDecoration(border: i > 0 ? const Border(top: BorderSide(color: _hairline)) : null),
                    child: Row(children: [
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('${lines[i]['what']}', style: _txt(12.5, weight: FontWeight.w700, color: _ink)),
                          Text('${_bDay(lines[i]['date'])} · ${lines[i]['ref']}',
                              maxLines: 1, overflow: TextOverflow.ellipsis, style: _txt(10.5, color: _mid)),
                        ]),
                      ),
                      Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                        Text(_bn(lines[i]['paid']) > 0 ? '-${_ugx(_bn(lines[i]['paid']))}' : '+${_ugx(_bn(lines[i]['billed']))}',
                            style: _txt(12.5, weight: FontWeight.w800, color: _bn(lines[i]['paid']) > 0 ? _green : _ink)),
                        Text('Owed ${_shortUgx(_bn(lines[i]['balance']))}', style: _txt(10, color: _light)),
                      ]),
                    ]),
                  ),
              ]),
            ),
          ],
        ]),
      ),
    );
  }

  Widget _bill(Map<String, dynamic> b, String today) {
    final late = b['due'] != null && '${b['due']}'.compareTo(today) < 0;
    final open = _paying == _bn(b['billId']);
    final ok = !_busy && _n > 0 && _n <= _bn(b['left']) && (_how == 'cash' || _ref.text.trim().length >= 3);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: _white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: late ? _ember.withOpacity(0.35) : _hairline),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Invoice ${b['ref']}', style: _txt(13, weight: FontWeight.w700, color: _ink)),
              Text(
                  '${_bDay(b['date'])}${b['due'] != null ? ' · ${late ? 'late since' : 'due'} ${_bDay(b['due'])}' : ''}',
                  style: _txt(11.5, color: late ? _ember : _mid)),
            ]),
          ),
          Text(_ugx(_bn(b['left'])), style: _txt(13.5, weight: FontWeight.w800, color: _ink)),
          const SizedBox(width: 8),
          if (!open)
            _Pressable(
              scale: 0.95,
              onTap: () => setState(() {
                _paying = _bn(b['billId']);
                _amount.text = '${_bn(b['left'])}';
                _formError = null;
                _done = null;
                _twice = false;
              }),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                decoration: BoxDecoration(color: _lime, borderRadius: BorderRadius.circular(16)),
                child: Text('Pay', style: _txt(12.5, weight: FontWeight.w800, color: _onLime)),
              ),
            ),
        ]),
        if (open) ...[
          const SizedBox(height: 10),
          _Field(
            controller: _amount,
            hint: 'Amount (UGX)',
            keyboardType: TextInputType.number,
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 8),
          _bChoice(const [
            ('bank', 'Bank'),
            ('cheque', 'Cheque'),
            ('mtn_momo', 'MTN'),
            ('airtel_money', 'Airtel'),
            ('cash', 'Cash'),
          ], _how, (v) => setState(() => _how = v)),
          if (_how != 'cash') ...[
            const SizedBox(height: 8),
            _Field(
              controller: _ref,
              hint: _how == 'cheque' ? 'Cheque number' : 'Transaction ID',
              capitalisation: TextCapitalization.characters,
              onChanged: (_) => setState(() {}),
            ),
          ],
          if (_n > _bn(b['left'])) ...[
            const SizedBox(height: 6),
            Text('Only ${_ugx(_bn(b['left']))} is owed on this bill.', style: _txt(12, color: _ember)),
          ],
          if (_formError != null) ...[
            const SizedBox(height: 8),
            Text(_formError!, style: _txt(12.5, color: _ember, height: 1.4)),
          ],
          if (_twice)
            _bTick('It is a second payment, not the same one again', _again,
                () => setState(() => _again = !_again)),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(
              child: _Pressable(
                scale: 0.98,
                onTap: () => setState(() => _paying = null),
                child: Container(
                  height: 46,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: _tile, borderRadius: BorderRadius.circular(23), border: Border.all(color: _hairline)),
                  child: Text('Cancel', style: _txt(14, weight: FontWeight.w600, color: _inkSoft)),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(flex: 2, child: _bButton('Pay ${_shortUgx(_n)}', ok ? () => _pay(b) : null, busy: _busy)),
          ]),
        ],
      ]),
    );
  }
}


// ═══════════════════════════════════════════════════════════════
//  OWNER APPROVAL — loans and big supplier payments waiting for a yes
// ═══════════════════════════════════════════════════════════════

/// On the home screen when something waits for this person to decide.
class _ApprovalsCard extends StatefulWidget {
  const _ApprovalsCard();

  @override
  State<_ApprovalsCard> createState() => _ApprovalsCardState();
}

class _ApprovalsCardState extends State<_ApprovalsCard> {
  List<Map<String, dynamic>> _rows = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await _apiGet('/api/approvals?status=pending');
      if (mounted) {
        setState(() => _rows = _bList(r['approvals'])
            .map((x) => (x as Map).cast<String, dynamic>())
            .where((a) => a['canDecide'] == true)
            .toList());
      }
    } on _ApiError {/* an older shop: nothing to show */}
  }

  @override
  Widget build(BuildContext context) {
    if (_rows.isEmpty) return const SizedBox.shrink();
    final total = _rows.fold<int>(0, (n, a) => n + _bn(a['amount']));
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: _Pressable(
        scale: 0.99,
        onTap: () async {
          await showModalBottomSheet<void>(
            context: context,
            isScrollControlled: true,
            useSafeArea: true,
            backgroundColor: Colors.transparent,
            builder: (_) => const _ApprovalsSheet(),
          );
          await _load();
        },
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: _amberPale,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: _amber.withOpacity(0.35)),
          ),
          child: Row(children: [
            Container(
              width: 42,
              height: 42,
              alignment: Alignment.center,
              decoration: const BoxDecoration(color: _amber, shape: BoxShape.circle),
              child: Text('${_rows.length}', style: _title(17, weight: FontWeight.w800, color: _white)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Waiting for your approval', style: _title(14.5, weight: FontWeight.w800)),
                const SizedBox(height: 2),
                Text(
                    '${_rows.take(2).map((a) => a['partyName']).join(', ')}${_rows.length > 2 ? ' and more' : ''} · ${_shortUgx(total)}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: _txt(12, color: _inkSoft)),
              ]),
            ),
            const Icon(Icons.chevron_right_rounded, color: _amber),
          ]),
        ),
      ),
    );
  }
}

/// Everything waiting, with what the owner needs to decide each.
class _ApprovalsSheet extends StatefulWidget {
  const _ApprovalsSheet();

  @override
  State<_ApprovalsSheet> createState() => _ApprovalsSheetState();
}

class _ApprovalsSheetState extends State<_ApprovalsSheet> {
  List<Map<String, dynamic>>? _rows;
  String _show = 'pending';
  String? _error;
  String? _done;
  int _busy = 0;
  int _refusing = 0;
  final _why = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _why.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final r = await _apiGet('/api/approvals?status=$_show');
      if (mounted) {
        setState(() {
          _rows = _bList(r['approvals']).map((x) => (x as Map).cast<String, dynamic>()).toList();
          _error = null;
        });
      }
    } on _ApiError catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _decide(Map<String, dynamic> a, bool approve) async {
    setState(() {
      _busy = _bn(a['id']);
      _error = null;
    });
    try {
      final r = await _apiPost('/api/approvals/${a['id']}/decide', {'approve': approve, 'note': approve ? '' : _why.text.trim()});
      HapticFeedback.mediumImpact();
      final ap = (r['approval'] as Map?)?.cast<String, dynamic>() ?? {};
      _why.clear();
      setState(() {
        _busy = 0;
        _refusing = 0;
        _done = approve
            ? 'Approved ${_ugx(_bn(a['amount']))} for ${a['partyName']}.${ap['receipt'] != null ? ' Receipt ${ap['receipt']}.' : ''}'
            : 'Refused. ${a['requestedBy']} has been told.';
      });
      await _load();
    } on _ApiError catch (e) {
      if (mounted) setState(() {
        _busy = 0;
        _error = e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final rows = _rows;
    return _Sheet(
      child: Padding(
        padding: EdgeInsets.fromLTRB(16, 4, 16, MediaQuery.paddingOf(context).bottom + 20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('Owner approval', style: _title(20, weight: FontWeight.w800)),
          const SizedBox(height: 2),
          Text('A loan only goes ahead when you say yes.', style: _txt(12.5, color: _mid)),
          const SizedBox(height: 12),
          _bChoice(const [('pending', 'Waiting'), ('approved', 'Approved'), ('rejected', 'Refused')], _show, (v) {
            setState(() {
              _show = v;
              _rows = null;
            });
            _load();
          }),
          if (_done != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: _greenPale, borderRadius: BorderRadius.circular(14)),
              child: Text(_done!, style: _txt(12.5, weight: FontWeight.w600, color: _green)),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 10),
            Text(_error!, style: _txt(12.5, color: _ember, height: 1.4)),
          ],
          const SizedBox(height: 10),
          if (rows == null)
            const Padding(
              padding: EdgeInsets.all(30),
              child: Center(child: CircularProgressIndicator(color: _brand)),
            )
          else if (rows.isEmpty)
            Padding(
              padding: const EdgeInsets.all(20),
              child: Text(_show == 'pending' ? 'Nothing is waiting for you.' : 'Nothing here.',
                  textAlign: TextAlign.center, style: _txt(13, color: _mid)),
            )
          else
            for (final (i, a) in rows.indexed) _rise(_card(a), i),
        ]),
      ),
    );
  }

  Widget _card(Map<String, dynamic> a) {
    final cu = (a['customer'] as Map?)?.cast<String, dynamic>();
    final hist = _bList(a['history']).map((x) => (x as Map).cast<String, dynamic>()).toList();
    final over = cu != null && _bn(cu['after']) > _bn(cu['limit']);
    final pending = a['status'] == 'pending';
    final refusing = _refusing == _bn(a['id']);
    Widget fig(String k, String v, Color c) => Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(k, style: _txt(10.5, color: _mid)),
            Text(v, maxLines: 1, style: _txt(13, weight: FontWeight.w800, color: c)),
          ]),
        );
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: pending ? _amber.withOpacity(0.35) : _hairline),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Expanded(
            child: Text('${a['partyName']}', style: _txt(14, weight: FontWeight.w800, color: _ink)),
          ),
          _bPill(a['kind'] == 'credit_sale' ? 'Loan' : 'Supplier', _blue, _bluePale),
        ]),
        const SizedBox(height: 4),
        Text(
            '${a['orderNo'] ?? ''}${a['orderNo'] != null ? ' · ' : ''}asked by ${a['requestedBy']} · ${_when('${a['requestedAt']}')}',
            style: _txt(11.5, color: _mid)),
        const SizedBox(height: 8),
        Text(_ugx(_bn(a['amount'])), style: _title(22, weight: FontWeight.w800)),
        if (_bn(a['paidNow']) > 0)
          Text('Order ${_ugx(_bn(a['total']))} · ${_ugx(_bn(a['paidNow']))} paid now', style: _txt(11.5, color: _inkSoft)),
        if (cu != null) ...[
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: _tile, borderRadius: BorderRadius.circular(12)),
            child: Row(children: [
              fig('Owes now', _shortUgx(_bn(cu['owed'])), _ink),
              fig('Limit', _shortUgx(_bn(cu['limit'])), _ink),
              fig('Late', _bn(cu['overdue']) > 0 ? _shortUgx(_bn(cu['overdue'])) : 'Nothing', _bn(cu['overdue']) > 0 ? _ember : _green),
              fig('After', _shortUgx(_bn(cu['after'])), over ? _ember : _ink),
            ]),
          ),
          if (over || _bn(cu['overdue']) > 0) ...[
            const SizedBox(height: 8),
            Text(
                [
                  if (over) 'Goes ${_ugx(_bn(cu['after']) - _bn(cu['limit']))} over the limit.',
                  if (_bn(cu['overdue']) > 0) '${_ugx(_bn(cu['overdue']))} already late.',
                ].join(' '),
                style: _txt(12, weight: FontWeight.w700, color: _ember)),
          ],
          const SizedBox(height: 8),
          Text('Paid in the last 90 days: ${_ugx(_bn(a['paidIn90']))}', style: _txt(11.5, weight: FontWeight.w600, color: _inkSoft)),
          for (final l in hist.take(4))
            Padding(
              padding: const EdgeInsets.only(top: 3),
              child: Row(children: [
                Expanded(child: Text('${_bDay(l['date'])} · ${l['what']}', style: _txt(11, color: _mid))),
                Text(_bn(l['credit']) > 0 ? '-${_shortUgx(_bn(l['credit']))}' : '+${_shortUgx(_bn(l['debit']))}',
                    style: _txt(11, weight: FontWeight.w700, color: _bn(l['credit']) > 0 ? _green : _ink)),
              ]),
            ),
        ],
        if (!pending) ...[
          const SizedBox(height: 8),
          Text(
              '${a['status'] == 'approved' ? 'Approved' : a['status'] == 'rejected' ? 'Refused' : 'Paid another way'}${a['decidedBy'] != null ? ' by ${a['decidedBy']}' : ''}${a['note'] != null ? ': “${a['note']}”' : ''}',
              style: _txt(12, weight: FontWeight.w600, color: a['status'] == 'approved' ? _green : _ember)),
        ] else if (a['canDecide'] != true) ...[
          const SizedBox(height: 8),
          Text(a['mine'] == true ? 'You asked for this. The owner decides it.' : 'Above what you may approve.',
              style: _txt(12, color: _mid)),
        ] else if (refusing) ...[
          const SizedBox(height: 10),
          _Field(controller: _why, hint: 'Why? The cashier reads this.', autofocus: true, onChanged: (_) => setState(() {})),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: _bButton('Back', () => setState(() => _refusing = 0), tint: _mid)),
            const SizedBox(width: 8),
            Expanded(child: _bButton('Refuse', _why.text.trim().length >= 3 ? () => _decide(a, false) : null, tint: _ember, busy: _busy == _bn(a['id']))),
          ]),
        ] else ...[
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: _bButton('Refuse', () => setState(() => _refusing = _bn(a['id'])), tint: _ember)),
            const SizedBox(width: 8),
            Expanded(flex: 2, child: _bButton('Approve', () => _decide(a, true), busy: _busy == _bn(a['id']))),
          ]),
        ],
      ]),
    );
  }
}
