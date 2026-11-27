// Automatic FlutterFlow imports
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/custom_code/widgets/index.dart'; // Imports other custom widgets
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart' hide RepeatMode;
// Begin custom widget code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!

// ╔═══════════════════════════════════════════════════════════════╗
// ║  NAME THIS CUSTOM WIDGET:   AlHadeedCompany                   ║
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
//     AlHadeedCompany
//
// Spelling and capitals both matter. Then switch on "Width and Height
// (required)" — this widget already accepts them — and Save.
//
// A company account: its people, its orders, its limit.


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
//  al_hadeed_shop.dart, al_hadeed_cart.dart,
//  al_hadeed_orders.dart and al_hadeed_manager.dart.
//
//  On a real phone `localhost` means the phone itself, so while testing
//  use the computer's LAN address: http://192.168.1.14:4000
// ═══════════════════════════════════════════════════════════════
const String _apiBase = 'https://pearlfx.online';

// Everything from here down to the screen itself is repeated, identically,
// in all five screen files. That is deliberate: FlutterFlow generates
// `custom_code/widgets/index.dart` as a list of
// `export 'al_hadeed_company.dart' show AlHadeedCompany;` lines, so a widget
// class is the only thing that crosses from one custom widget file to
// another. A shared helper is simply not visible, and the build fails
// with "The function '_txt' isn't defined".

// ═══════════════════════════════════════════════════════════════
//  TOKENS — identical in shop, cart, orders, company and manager.
// ═══════════════════════════════════════════════════════════════
const Color _white = Color(0xFFFFFFFF);
const Color _bg = Color(0xFFF5F7FB);
const Color _ink = Color(0xFF0F1B33);
const Color _inkSoft = Color(0xFF394862);
const Color _mid = Color(0xFF55637D);
const Color _light = Color(0xFF626F88);
const Color _hairline = Color(0xFFE2E8F2);
const Color _tile = Color(0xFFF9FAFD);
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
const List<BoxShadow> _cardShadow = [];

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
                colors: [_white, _white],
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
        transitionDuration: Duration.zero,
        reverseTransitionDuration: Duration.zero,
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
      child: Container(
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(
          color: _white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: _hairline),
        ),
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
            colors: [_lime, _lime],
          ),
          borderRadius: BorderRadius.vertical(bottom: Radius.circular(26)),
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
                    _white.withOpacity(0),
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
                        Text('Al Hadeed Hardware',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: _title(17,
                                weight: FontWeight.w800, color: _onLime)),
                        const SizedBox(height: 2),
                        Text(subtitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style:
                                _txt(12.5, color: _onLime.withOpacity(0.92))),
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
  Widget build(BuildContext context) => Center(
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
//  SCREEN 4 OF 4 — THE COMPANY (and the account)
// ═══════════════════════════════════════════════════════════════

/// Two screens in one, chosen by who is signed in.
///
/// A **company owner** gets the staff register: who may order in the
/// company's name, what each of them may spend, and every order they
/// have placed. Adding, suspending and re-limiting are all sheets.
///
/// Everyone else — an individual customer, or a company's own staff —
/// gets their account: who they are, what their ceiling is, and the way
/// out. There is no point showing a buyer a register they cannot edit.
class AlHadeedCompany extends StatefulWidget {
  const AlHadeedCompany({super.key, this.width, this.height});

  /// FlutterFlow fills these in from the canvas when "Width and Height"
  /// is switched on. They are not something to wire up, but the
  /// constructor has to accept them or saving fails with:
  /// Parameter "width" not found.
  final double? width;
  final double? height;

  @override
  State<AlHadeedCompany> createState() => _AlHadeedCompanyState();
}

class _AlHadeedCompanyState extends State<AlHadeedCompany> {
  bool _sessionRead = false;
  List<Map<String, dynamic>> _staff = [];
  List<Map<String, dynamic>> _orders = [];
  Map<String, dynamic>? _company;
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
    setState(() => _sessionRead = true);
    if (_Session().isStaff) return;
    await _CartStore().load();
    if (!mounted) return;
    if (!_Session().isCompanyOwner) {
      setState(() => _loading = false);
      return;
    }
    await _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final company = await _apiGet('/api/company');
      final staff = await _apiGet('/api/company/staff');
      final orders = await _apiGet('/api/company/orders');
      if (!mounted) return;
      setState(() {
        _company = company['company'] as Map<String, dynamic>?;
        _staff = (staff['staff'] as List).cast<Map<String, dynamic>>();
        _orders = (orders['orders'] as List).cast<Map<String, dynamic>>();
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

  Future<void> _openAddStaff() => showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        backgroundColor: Colors.transparent,
        builder: (_) => const _StaffSheet(),
      ).then((added) {
        if (added == true) _load();
      });

  Future<void> _openStaff(Map<String, dynamic> member) =>
      showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        backgroundColor: Colors.transparent,
        builder: (_) => _StaffSheet(member: member),
      ).then((changed) {
        if (changed == true) _load();
      });

  Future<void> _openSignIn() async {
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _SignInSheet(),
    );
    if (ok == true && mounted) await _boot();
  }

  Future<void> _openProfile() => showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        backgroundColor: Colors.transparent,
        builder: (_) => const _ProfileSheet(),
      ).then((_) {
        if (!_Session().signedIn && mounted) {
          Navigator.of(context).pushReplacement(PageRouteBuilder(
            pageBuilder: (_, __, ___) => const AlHadeedShop(),
            transitionDuration: Duration.zero,
          ));
        }
      });

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    _ui = (mq.size.width / 390).clamp(0.86, 1.08);
    if (!_sessionRead) return Container(color: _bg);
    // Staff have their own side of the app. It replaces this screen, so
    // there is no shop underneath to go back to.
    if (_Session().isStaff) {
      return AlHadeedStaff(width: widget.width, height: widget.height);
    }
    final owner = _Session().isCompanyOwner;

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
                  subtitle: owner
                      ? '${_Session().companyName} · Owner view'
                      : 'Your account',
                  trailing: _Pressable(
                    scale: 0.9,
                    onTap: _Session().signedIn ? _openProfile : _openSignIn,
                    child: Container(
                      width: 38,
                      height: 38,
                      decoration: _liquid(circle: true, onDark: true),
                      child: const Icon(Icons.person_outline_rounded,
                          size: 19, color: _onLime),
                    ),
                  ),
                ),
                Expanded(child: owner ? _ownerBody(mq) : _accountBody()),
              ],
            ),
            bottomNavigationBar: const _BottomBar(current: 'company'),
          ),
        ),
      ),
    );
  }

  // --- The owner's register ---------------------------------------------

  Widget _ownerBody(MediaQueryData mq) {
    if (_loading) {
      return ListView(
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
        children: [
          _Skeleton(mq.size.width - 28, 78, radius: 16),
          const SizedBox(height: 16),
          for (var i = 0; i < 4; i++) ...[
            _Skeleton(mq.size.width - 28, 72, radius: 16),
            const SizedBox(height: 10),
          ],
        ],
      );
    }

    if (_error != null) {
      return _Empty(
        icon: Icons.cloud_off_rounded,
        tone: _ember,
        title: "Couldn't load the company",
        line: _error!,
        action: 'Try again',
        onAction: _load,
      );
    }

    final active = _staff.where((s) => s['status'] == 'active').length;
    final spent = _orders.fold<int>(
        0, (n, o) => n + ((o['total'] as num?)?.toInt() ?? 0));

    return RefreshIndicator(
      color: _brand,
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(
            parent: BouncingScrollPhysics()),
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 20),
        children: [
          const _CreditCard(),
          // What the owner opened the app to see.
          Row(
            children: [
              Expanded(
                  child: _stat('Staff who can order', '$active',
                      'of ${_staff.length}')),
              const SizedBox(width: 10),
              Expanded(
                  child: _stat('Orders in the company name',
                      '${_orders.length}', 'all time')),
            ],
          ),
          const SizedBox(height: 10),
          _stat('Spent through the company', _shortUgx(spent),
              _ugx(spent), wide: true),

          const SizedBox(height: 22),
          Row(
            children: [
              Text('COMPANY STAFF',
                  style:
                      _txt(11.5, weight: FontWeight.w700, color: _light)),
              const Spacer(),
              _Pressable(
                scale: 0.94,
                onTap: _openAddStaff,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 7),
                  decoration: _liquid(tint: _lime, radius: 16),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.add_rounded, size: 15, color: _onLime),
                      const SizedBox(width: 5),
                      Text('Add staff',
                          style: _txt(12.5,
                              weight: FontWeight.w700, color: _onLime)),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (_staff.isEmpty)
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: _white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: _hairline),
              ),
              child: Text(
                'Nobody yet. Add your buyer or site supervisor and they can '
                'order in the company name, up to the limit you set.',
                style: _txt(13.5, color: _mid, height: 1.5),
              ),
            )
          else
            for (final member in _staff) _staffCard(member),

          const SizedBox(height: 22),
          Text('ALL COMPANY ORDERS',
              style: _txt(11.5, weight: FontWeight.w700, color: _light)),
          const SizedBox(height: 10),
          if (_orders.isEmpty)
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: _white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: _hairline),
              ),
              child: Text('No orders in the company name yet.',
                  style: _txt(13.5, color: _mid)),
            )
          else
            for (final o in _orders) _orderRow(o),
        ],
      ),
    );
  }

  Widget _stat(String label, String value, String sub, {bool wide = false}) =>
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: _white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: _hairline),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: _txt(11.5, color: _mid, height: 1.3)),
            const SizedBox(height: 6),
            Text(value, style: _title(wide ? 22 : 20, weight: FontWeight.w800)),
            const SizedBox(height: 2),
            Text(sub, style: _txt(11.5, color: _light)),
          ],
        ),
      );

  Widget _staffCard(Map<String, dynamic> m) {
    final suspended = m['status'] != 'active';
    final limit = (m['spendingLimit'] as num?)?.toInt();

    return _Pressable(
      scale: 0.98,
      onTap: () => _openStaff(m),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: _white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: _hairline),
        ),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: suspended ? _tile : _brandPale,
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: Text(
                (m['fullName'] as String? ?? '?')
                    .characters
                    .first
                    .toUpperCase(),
                style: _title(17,
                    weight: FontWeight.w800,
                    color: suspended ? _light : _brandDark),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(m['fullName'] as String? ?? '',
                      style: _txt(14.5,
                          weight: FontWeight.w600,
                          color: suspended ? _mid : _ink)),
                  const SizedBox(height: 2),
                  Text(
                    [
                      if (m['staffRole'] != null) '${m['staffRole']}',
                      if (limit != null)
                        'limit ${_shortUgx(limit)}'
                      else
                        'no limit',
                    ].join(' · '),
                    style: _txt(12, color: _mid),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${m['orderCount'] ?? 0} orders · '
                    '${_shortUgx((m['totalSpent'] as num?)?.toInt() ?? 0)} spent',
                    style: _txt(11.5, color: _light),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            _Chip(suspended ? 'Suspended' : 'Active',
                bg: suspended ? _emberPale : _greenPale,
                fg: suspended ? _ember : _green),
          ],
        ),
      ),
    );
  }

  Widget _orderRow(Map<String, dynamic> o) {
    final status = o['status'] as String? ?? '';
    final (bg, fg) = _statusColours(status);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _hairline),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text('#${o['order_no'] ?? ''}',
                        style: _txt(14,
                            weight: FontWeight.w700, color: _ink)),
                    const SizedBox(width: 7),
                    _Chip(_statusLabel(status), bg: bg, fg: fg),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  '${o['ordered_by_name'] ?? ''} · '
                  '${_when(o['created_at'] as String?)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: _txt(12, color: _mid),
                ),
              ],
            ),
          ),
          Text(_ugx((o['total'] as num?)?.toInt() ?? 0),
              style: _txt(14, weight: FontWeight.w800, color: _ink)),
        ],
      ),
    );
  }

  // --- Everyone else's account ------------------------------------------

  Widget _accountBody() {
    final s = _Session();
    if (!s.signedIn) {
      return _Empty(
        icon: Icons.lock_outline_rounded,
        title: 'Not signed in',
        line: 'Sign in to order and follow your orders. Staff sign in here '
            'too and go straight to their desk.',
        action: 'Sign in',
        onAction: _openSignIn,
      );
    }
    return _CustomerHome(onProfile: _openProfile);
  }

  Widget _accountRow(String k, String v, {bool last = false}) => Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
            child: Row(
              children: [
                Expanded(child: Text(k, style: _txt(14, color: _inkSoft))),
                const SizedBox(width: 12),
                Text(v,
                    style: _txt(14, weight: FontWeight.w600, color: _ink)),
              ],
            ),
          ),
          if (!last)
            const Padding(
              padding: EdgeInsets.only(left: 14),
              child: Divider(height: 1, thickness: 1, color: _hairline),
            ),
        ],
      );
}

// ═══════════════════════════════════════════════════════════════
//  SHEET — ADD OR EDIT A STAFF MEMBER
// ═══════════════════════════════════════════════════════════════

/// One sheet for both jobs. With no `member` it adds; with one it edits
/// the role and the limit, and can suspend, reactivate or remove.
///
/// Pops `true` if anything changed, so the register behind it reloads.
class _StaffSheet extends StatefulWidget {
  const _StaffSheet({this.member});

  final Map<String, dynamic>? member;

  @override
  State<_StaffSheet> createState() => _StaffSheetState();
}

class _StaffSheetState extends State<_StaffSheet> {
  final _formKey = GlobalKey<FormState>();
  late final _name =
      TextEditingController(text: widget.member?['fullName'] as String? ?? '');
  late final _phone =
      TextEditingController(text: widget.member?['phone'] as String? ?? '');
  late final _role = TextEditingController(
      text: widget.member?['staffRole'] as String? ?? '');
  late final _limit = TextEditingController(
      text: (widget.member?['spendingLimit'] as num?)?.toInt().toString() ?? '');

  bool _busy = false;
  String? _error;

  bool get _editing => widget.member != null;
  int get _id => (widget.member?['id'] as num?)?.toInt() ?? 0;
  bool get _suspended => widget.member?['status'] != 'active';

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _role.dispose();
    _limit.dispose();
    super.dispose();
  }

  String? _validateName(String? v) =>
      (v == null || v.trim().length < 2) ? 'Enter their name.' : null;

  /// Ugandan numbers are 10 digits as people write them (0772 123 456),
  /// 9 without the leading zero, 12 with the country code. Nine is the
  /// shortest thing that could be real.
  String? _validatePhone(String? v) =>
      (v == null || v.replaceAll(RegExp(r'[^0-9]'), '').length < 9)
          ? 'They sign in with this number, so it has to be right.'
          : null;

  String? _validateRole(String? v) => (v == null || v.trim().length < 2)
      ? 'Cashier, Buyer, Site Supervisor…'
      : null;

  int? get _limitValue {
    final raw = _limit.text.replaceAll(RegExp(r'[^0-9]'), '');
    return raw.isEmpty ? null : int.tryParse(raw);
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final navigator = Navigator.of(context);
    try {
      if (_editing) {
        await _apiSend('PATCH', '/api/company/staff/$_id', {
          'fullName': _name.text.trim(),
          'staffRole': _role.text.trim(),
          'spendingLimit': _limitValue,
        });
      } else {
        await _apiPost('/api/company/staff', {
          'fullName': _name.text.trim(),
          'phone': _phone.text.trim(),
          'staffRole': _role.text.trim(),
          'spendingLimit': _limitValue,
        });
      }
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

  Future<void> _toggleSuspend() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final navigator = Navigator.of(context);
    try {
      await _apiSend('PATCH', '/api/company/staff/$_id',
          {'status': _suspended ? 'active' : 'suspended'});
      if (!mounted) return;
      navigator.pop(true);
    } on _ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _busy = false;
      });
    }
  }

  Future<void> _remove() async {
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ConfirmSheet(
        icon: Icons.person_remove_outlined,
        title: 'Remove ${_name.text.trim()}?',
        line: 'They can no longer order in the company name. Orders they '
            'have already placed stay on the record.',
        confirm: 'Remove',
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _busy = true);
    final navigator = Navigator.of(context);
    try {
      await _apiSend('DELETE', '/api/company/staff/$_id', {});
      if (!mounted) return;
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
              Text(_editing ? 'Staff member' : 'Add a staff member',
                  style: _title(21)),
              const SizedBox(height: 4),
              Text(
                _editing
                    ? 'They sign in with their own phone number. Change what '
                        'they may spend, or stop them ordering altogether.'
                    : 'They order in the company name, on their own phone, up '
                        'to the limit you set here.',
                style: _txt(13, color: _mid, height: 1.45),
              ),
              const SizedBox(height: 18),
              _Field(
                controller: _name,
                hint: 'Full name',
                capitalisation: TextCapitalization.words,
                validator: _validateName,
              ),
              const SizedBox(height: 10),
              if (!_editing) ...[
                _Field(
                  controller: _phone,
                  hint: 'Phone, e.g. 0772 123 456',
                  keyboardType: TextInputType.phone,
                  validator: _validatePhone,
                ),
                const SizedBox(height: 10),
              ],
              _Field(
                controller: _role,
                hint: 'Role: Cashier, Buyer, Site Supervisor',
                capitalisation: TextCapitalization.words,
                validator: _validateRole,
              ),
              const SizedBox(height: 10),
              _Field(
                controller: _limit,
                hint: 'Spending limit per order (blank = no limit)',
                keyboardType: TextInputType.number,
                onChanged: (_) => setState(() {}),
              ),
              if (_limitValue != null) ...[
                const SizedBox(height: 6),
                Text(_ugx(_limitValue!),
                    style: _txt(12.5,
                        weight: FontWeight.w600, color: _brandDark)),
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
                onTap: _busy ? null : _submit,
                child: Container(
                  height: 52,
                  width: double.infinity,
                  alignment: Alignment.center,
                  decoration: _liquid(tint: _lime, radius: 26),
                  child: _busy
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: _onLime),
                        )
                      : Text(_editing ? 'Save changes' : 'Add staff member',
                          style: _txt(15,
                              weight: FontWeight.w600, color: _onLime)),
                ),
              ),
              if (_editing) ...[
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: _Pressable(
                        scale: 0.98,
                        onTap: _busy ? null : _toggleSuspend,
                        child: Container(
                          height: 48,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: _suspended ? _greenPale : _brandPale,
                            borderRadius: BorderRadius.circular(24),
                          ),
                          child: Text(_suspended ? 'Reactivate' : 'Suspend',
                              style: _txt(14,
                                  weight: FontWeight.w600,
                                  color:
                                      _suspended ? _green : _brandDark)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _Pressable(
                        scale: 0.98,
                        onTap: _busy ? null : _remove,
                        child: Container(
                          height: 48,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: _emberPale,
                            borderRadius: BorderRadius.circular(24),
                          ),
                          child: Text('Remove',
                              style: _txt(14,
                                  weight: FontWeight.w600, color: _ember)),
                        ),
                      ),
                    ),
                  ],
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
            const SizedBox(height: 6),
            Center(
              child: TextButton(
                onPressed: () => _DeleteAccountSheet.open(context),
                child: Text('Delete account',
                    style: _txt(13.5, weight: FontWeight.w600, color: _mid)),
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
//  SHEET — DELETE ACCOUNT
// ═══════════════════════════════════════════════════════════════

/// Deleting the account, for good. The word is typed out, because this
/// is the one thing in the app that cannot be put right afterwards.
class _DeleteAccountSheet extends StatefulWidget {
  const _DeleteAccountSheet();

  static Future<void> open(BuildContext context) => showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        backgroundColor: Colors.transparent,
        builder: (_) => const _DeleteAccountSheet(),
      );

  @override
  State<_DeleteAccountSheet> createState() => _DeleteAccountSheetState();
}

class _DeleteAccountSheetState extends State<_DeleteAccountSheet> {
  final _word = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _word.dispose();
    super.dispose();
  }

  bool get _ready => !_busy && _word.text.trim().toUpperCase() == 'DELETE';

  Future<void> _delete() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final navigator = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await _apiPost('/api/account/delete', {'confirm': 'DELETE'});
    } on _ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message;
      });
      return;
    }

    // The phone forgets them too: the session, the cart, and the name,
    // number and address the cart keeps for next time.
    await _Session().signOut();
    await _CartStore().clear();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('alhadeed.details');

    HapticFeedback.mediumImpact();
    navigator.pushAndRemoveUntil(
      PageRouteBuilder<void>(
        pageBuilder: (_, __, ___) => const AlHadeedShop(),
        transitionDuration: Duration.zero,
      ),
      (_) => false,
    );
    messenger.showSnackBar(
      const SnackBar(
        behavior: SnackBarBehavior.floating,
        content: Text('Your account has been deleted.'),
      ),
    );
  }

  Widget _point(IconData icon, String text) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 18, color: _mid),
            const SizedBox(width: 10),
            Expanded(
                child: Text(text, style: _txt(13.5, height: 1.45))),
          ],
        ),
      );

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    final owner = _Session().isCompanyOwner;

    return _Sheet(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Delete your account', style: _title(22)),
            const SizedBox(height: 6),
            Text('This cannot be undone.',
                style: _txt(13.5, weight: FontWeight.w600, color: _ember)),
            const SizedBox(height: 18),
            _point(Icons.person_off_outlined,
                'Your account, name, phone number, email and addresses are deleted now.'),
            _point(Icons.receipt_long_outlined,
                'Past orders and receipts stay in the shop\'s books, without your name on them. Payment screenshots stay with their receipts.'),
            _point(Icons.remove_shopping_cart_outlined,
                'Orders you have not paid for are cancelled. One you have paid for must be collected or refunded first.'),
            if (owner)
              _point(Icons.group_off_outlined,
                  'The people on your company account become ordinary customers.'),
            const SizedBox(height: 6),
            Text('Type DELETE to confirm',
                style: _txt(13, weight: FontWeight.w600, color: _ink)),
            const SizedBox(height: 8),
            _Field(
              controller: _word,
              hint: 'Type it here',
              capitalisation: TextCapitalization.characters,
              onChanged: (_) => setState(() {}),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: _txt(13, color: _ember, height: 1.4)),
            ],
            const SizedBox(height: 18),
            _Pressable(
              scale: 0.98,
              onTap: _ready ? _delete : null,
              child: Opacity(
                opacity: _ready || _busy ? 1 : 0.45,
                child: Container(
                  height: 46,
                  width: double.infinity,
                  alignment: Alignment.center,
                  decoration: _liquid(tint: _ember, radius: 25),
                  child: _busy
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: _white))
                      : Text('Delete my account for good',
                          style: _txt(15,
                              weight: FontWeight.w600, color: _white)),
                ),
              ),
            ),
            Center(
              child: TextButton(
                onPressed: _busy ? null : () => Navigator.of(context).pop(),
                child: Text('Keep my account',
                    style: _txt(14, weight: FontWeight.w600, color: _inkSoft)),
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
//  SHEET — ARE YOU SURE
// ═══════════════════════════════════════════════════════════════

/// One sheet for every "are you sure", so a destructive answer always
/// looks and reads the same way. Pops `true` when confirmed.
class _ConfirmSheet extends StatelessWidget {
  const _ConfirmSheet({
    required this.icon,
    required this.title,
    required this.line,
    required this.confirm,
  });

  final IconData icon;
  final String title;
  final String line;
  final String confirm;

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
              decoration: const BoxDecoration(
                  color: _emberPale, shape: BoxShape.circle),
              child: Icon(icon, size: 26, color: _ember),
            ),
            const SizedBox(height: 14),
            Text(title, style: _title(20)),
            const SizedBox(height: 6),
            Text(line, style: _txt(13.5, color: _mid, height: 1.5)),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: _Pressable(
                    scale: 0.98,
                    onTap: () => Navigator.of(context).pop(false),
                    child: Container(
                      height: 46,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: _tile,
                        borderRadius: BorderRadius.circular(25),
                        border: Border.all(color: _hairline),
                      ),
                      child: Text('Keep it',
                          style: _txt(14.5,
                              weight: FontWeight.w600, color: _inkSoft)),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _Pressable(
                    scale: 0.98,
                    onTap: () => Navigator.of(context).pop(true),
                    child: Container(
                      height: 46,
                      alignment: Alignment.center,
                      decoration: _liquid(tint: _ember, radius: 25),
                      child: Text(confirm,
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
//  SHEET — SIGN IN
//
//  Identical in al_hadeed_shop.dart, al_hadeed_cart.dart and
//  al_hadeed_company.dart.
// ═══════════════════════════════════════════════════════════════

/// One sign-in for everybody: a customer with an SMS code, or anybody
/// with a password. Whose account it turns out to be decides which side
/// of the app opens. Pops `true` once signed in.
class _SignInSheet extends StatefulWidget {
  const _SignInSheet();

  @override
  State<_SignInSheet> createState() => _SignInSheetState();
}

class _SignInSheetState extends State<_SignInSheet> {
  final _phone = TextEditingController();
  final _name = TextEditingController();
  final _code = TextEditingController();
  final _who = TextEditingController();
  final _password = TextEditingController();

  bool _usePassword = false;
  bool _askName = false;
  bool _sent = false;
  bool _busy = false;
  bool _hidden = true;
  String? _error;
  String? _devCode;

  @override
  void dispose() {
    for (final c in [_phone, _name, _code, _who, _password]) {
      c.dispose();
    }
    super.dispose();
  }

  bool get _ready {
    if (_busy) return false;
    if (_usePassword) {
      return _who.text.trim().length >= 3 && _password.text.isNotEmpty;
    }
    if (_sent) return _code.text.trim().length == 6;
    return _phone.text.replaceAll(RegExp(r'[^0-9]'), '').length >= 9 &&
        (!_askName || _name.text.trim().length >= 2);
  }

  /// A shop whose plugin is older than this app has only the staff door.
  Future<Map<String, dynamic>> _passwordSignIn() async {
    final body = {
      'identifier': _who.text.trim(),
      'password': _password.text,
    };
    try {
      return await _apiPost('/api/auth/login', body);
    } on _ApiError catch (e) {
      if (e.code != 'rest_no_route') rethrow;
      return _apiPost('/api/auth/staff/login', body);
    }
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final navigator = Navigator.of(context);
    try {
      if (!_usePassword && !_sent) {
        final r = await _apiPost('/api/auth/otp/request', {
          'phone': _phone.text.trim(),
          if (_askName) 'fullName': _name.text.trim(),
        });
        if (!mounted) return;
        setState(() {
          _sent = true;
          _busy = false;
          // Only ever sent back by a shop still in test mode.
          _devCode = r['devCode']?.toString();
        });
        return;
      }

      final r = _usePassword
          ? await _passwordSignIn()
          : await _apiPost('/api/auth/otp/verify', {
              'phone': _phone.text.trim(),
              'code': _code.text.trim(),
              if (_askName) 'fullName': _name.text.trim(),
            });
      final token = r['token'] as String;
      final user = (r['user'] as Map).cast<String, dynamic>();
      await _Session().save(token, user);

      // The sign-in gives a company's id but not its name, which the
      // header shows. Cosmetic: a failure here leaves the sign-in alone.
      if (user['companyId'] != null) {
        try {
          final me = await _apiGet('/api/auth/me');
          final full = (me['user'] as Map).cast<String, dynamic>();
          final company = full['company'] as Map<String, dynamic>?;
          if (company != null) full['companyName'] = company['company_name'];
          await _Session().save(token, full);
        } on _ApiError {
          // Keep the session we already have.
        }
      }
      HapticFeedback.mediumImpact();
      navigator.pop(true);
    } on _ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        // A number the shop has not met: ask for a name, then carry on.
        if (e.code == 'ah_unknown_phone' && !_askName) {
          _askName = true;
        } else {
          _error = e.message;
        }
      });
    }
  }

  Widget _tab(String label, IconData icon, bool password) {
    final on = _usePassword == password;
    return Expanded(
      child: _Pressable(
        scale: 0.97,
        onTap: _busy
            ? null
            : () => setState(() {
                  _usePassword = password;
                  _error = null;
                }),
        child: Container(
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: on ? _white : _white.withOpacity(0),
            borderRadius: BorderRadius.circular(12),
            boxShadow: on ? _cardShadow : null,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 17, color: on ? _brand : _mid),
              const SizedBox(width: 7),
              Text(label,
                  style: _txt(13.5,
                      weight: on ? FontWeight.w700 : FontWeight.w500,
                      color: on ? _ink : _mid)),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    final again = (_) => setState(() {});
    final help = _usePassword
        ? 'Use your email or phone number and your password. Staff sign in '
            'here too.'
        : _sent
            ? 'We sent a 6-digit code to ${_phone.text.trim()}. It expires in '
                '5 minutes.'
            : _askName
                ? 'That number is new here. Add your name and we will text a '
                    'code to create your account.'
                : 'Enter your phone number and we will text you a code.';

    return _Sheet(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Sign in', style: _title(22, weight: FontWeight.w800)),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: _bg,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(children: [
                _tab('SMS code', Icons.sms_outlined, false),
                _tab('Password', Icons.lock_outline_rounded, true),
              ]),
            ),
            const SizedBox(height: 14),
            Text(help, style: _txt(13, color: _mid, height: 1.45)),
            const SizedBox(height: 14),
            if (_usePassword) ...[
              _Field(
                key: const ValueKey('who'),
                controller: _who,
                hint: 'Email or phone number',
                keyboardType: TextInputType.emailAddress,
                onChanged: again,
              ),
              const SizedBox(height: 10),
              _Field(
                key: const ValueKey('password'),
                controller: _password,
                hint: 'Password',
                obscure: _hidden,
                onChanged: again,
              ),
              TextButton(
                onPressed: () => setState(() => _hidden = !_hidden),
                child: Text(_hidden ? 'Show password' : 'Hide password',
                    style: _txt(12.5,
                        weight: FontWeight.w600, color: _brandDark)),
              ),
            ] else if (_sent) ...[
              _Field(
                key: const ValueKey('code'),
                controller: _code,
                hint: '6-digit code',
                keyboardType: TextInputType.number,
                maxLength: 6,
                autofocus: true,
                onChanged: again,
              ),
              if (_devCode != null) ...[
                const SizedBox(height: 8),
                Text('Test mode: your code is $_devCode',
                    style: _txt(12.5, color: _brandDark)),
              ],
            ] else ...[
              _Field(
                key: const ValueKey('phone'),
                controller: _phone,
                hint: '0772 123 456',
                keyboardType: TextInputType.phone,
                onChanged: (_) => setState(() => _askName = false),
              ),
              if (_askName) ...[
                const SizedBox(height: 10),
                _Field(
                  key: const ValueKey('name'),
                  controller: _name,
                  hint: 'Your name',
                  capitalisation: TextCapitalization.words,
                  autofocus: true,
                  onChanged: again,
                ),
              ],
            ],
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: _txt(12.5, color: _ember, height: 1.4)),
            ],
            const SizedBox(height: 18),
            _Pressable(
              scale: 0.98,
              onTap: _ready ? _submit : null,
              child: Opacity(
                opacity: _ready || _busy ? 1 : 0.45,
                child: Container(
                  height: 52,
                  width: double.infinity,
                  alignment: Alignment.center,
                  decoration: _liquid(tint: _lime, radius: 26),
                  child: _busy
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: _onLime),
                        )
                      : Text(
                          _usePassword
                              ? 'Sign in'
                              : _sent
                                  ? 'Verify & sign in'
                                  : 'Text me a code',
                          style: _txt(15,
                              weight: FontWeight.w600, color: _onLime)),
                ),
              ),
            ),
            if (_sent && !_usePassword)
              Center(
                child: TextButton(
                  onPressed: _busy
                      ? null
                      : () => setState(() {
                            _sent = false;
                            _askName = false;
                            _code.clear();
                            _devCode = null;
                            _error = null;
                          }),
                  child: Text('Use a different number',
                      style: _txt(13.5,
                          weight: FontWeight.w600, color: _brandDark)),
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
//  MY CREDIT
//
//  For a customer the shop lets buy now and pay later: how much they
//  may owe, how much they owe, what is left, what is late, and every
//  line, like the shop's own notebook. Shows nothing for anyone else.
// ═══════════════════════════════════════════════════════════════

String _creditDay(String? iso) {
  if (iso == null || iso.length < 10) return '';
  const m = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  final mo = int.tryParse(iso.substring(5, 7)) ?? 1;
  return '${int.tryParse(iso.substring(8, 10)) ?? ''} ${m[mo - 1]} ${iso.substring(0, 4)}';
}

int _ci(Object? v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;

class _CreditCard extends StatefulWidget {
  const _CreditCard();

  @override
  State<_CreditCard> createState() => _CreditCardState();
}

class _CreditCardState extends State<_CreditCard> {
  Map<String, dynamic>? _data;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await _apiGet('/api/me/credit');
      if (mounted) setState(() => _data = r);
    } on _ApiError {
      // No credit, or an older shop: the card simply does not show.
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = (_data?['account'] as Map?)?.cast<String, dynamic>();
    if (a == null) return const SizedBox.shrink();
    final owed = _ci(a['owed']);
    final limit = _ci(a['limit']);
    final left = _ci(a['available']);
    final late = _ci(a['overdue']);
    final used = limit > 0 ? (owed / limit).clamp(0.0, 1.0) : 1.0;
    final barColour = late > 0 || used >= 1
        ? _ember
        : used >= 0.8
            ? _amber
            : _onLime;

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: _Pressable(
        scale: 0.98,
        onTap: () => showModalBottomSheet<void>(
          context: context,
          isScrollControlled: true,
          useSafeArea: true,
          backgroundColor: Colors.transparent,
          builder: (_) => _CreditSheet(data: _data!),
        ),
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
          decoration: BoxDecoration(
            color: _lime,
            borderRadius: BorderRadius.circular(18),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                const Icon(Icons.account_balance_wallet_rounded,
                    size: 18, color: _onLime),
                const SizedBox(width: 7),
                Text('My loan',
                    style: _txt(13, weight: FontWeight.w700, color: _onLime)),
                const Spacer(),
                Text('See all',
                    style: _txt(12, weight: FontWeight.w700, color: _onLime)),
                const Icon(Icons.chevron_right_rounded,
                    size: 18, color: _onLime),
              ]),
              const SizedBox(height: 8),
              Text(owed < 0 ? 'Paid in advance' : 'Your loan (debit)',
                  style: _txt(11.5, color: _onLime.withOpacity(0.75))),
              Text(_ugx(owed.abs()),
                  style: _title(25, weight: FontWeight.w800, color: _onLime)),
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: used,
                  minHeight: 7,
                  backgroundColor: _white.withOpacity(0.45),
                  color: barColour,
                ),
              ),
              const SizedBox(height: 8),
              Row(children: [
                Expanded(
                  child: Text('${_ugx(left)} left to use',
                      style: _txt(12, weight: FontWeight.w700, color: _onLime)),
                ),
                Text('Limit ${_shortUgx(limit)}',
                    style: _txt(12, color: _onLime.withOpacity(0.8))),
              ]),
              if (late > 0 || a['blocked'] != null) ...[
                const SizedBox(height: 10),
                Container(
                  width: double.infinity,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: _white.withOpacity(0.92),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                      late > 0
                          ? '${_ugx(late)} is late. Please pay it to take more on loan.'
                          : '${a['blocked']}',
                      style: _txt(12, weight: FontWeight.w600, color: _ember)),
                ),
              ] else if (a['nextDue'] != null) ...[
                const SizedBox(height: 6),
                Text('Next bill due ${_creditDay('${a['nextDue']}')}',
                    style: _txt(11.5, color: _onLime.withOpacity(0.8))),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// The whole account: figures, bills not paid, every line, how to pay.
class _CreditSheet extends StatelessWidget {
  const _CreditSheet({required this.data});
  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final a = (data['account'] as Map).cast<String, dynamic>();
    final bills = ((data['bills'] as List?) ?? const [])
        .map((x) => (x as Map).cast<String, dynamic>())
        .toList();
    final lines = ((data['statement'] as List?) ?? const [])
        .map((x) => (x as Map).cast<String, dynamic>())
        .toList();
    final today = DateTime.now().toIso8601String().substring(0, 10);

    Widget fig(String k, String v, {Color colour = _ink}) => Expanded(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
            decoration: BoxDecoration(
              color: _tile,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _hairline),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(k, style: _txt(10.5, color: _mid)),
                const SizedBox(height: 2),
                Text(v,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: _txt(13, weight: FontWeight.w800, color: colour)),
              ],
            ),
          ),
        );

    Widget heading(String t) => Padding(
          padding: const EdgeInsets.only(top: 16, bottom: 6),
          child: Text(t,
              style: _txt(11, weight: FontWeight.w800, color: _light)),
        );

    return _Sheet(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
            16, 4, 16, MediaQuery.paddingOf(context).bottom + 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(children: [
              Expanded(child: Text('My loan', style: _title(20, weight: FontWeight.w800))),
              _Pressable(
                scale: 0.95,
                onTap: () => _openDoc(context, 'statement', '', download: true),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(color: _lime, borderRadius: BorderRadius.circular(18)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.download_rounded, size: 16, color: _onLime),
                    const SizedBox(width: 5),
                    Text('Statement PDF', style: _txt(12, weight: FontWeight.w800, color: _onLime)),
                  ]),
                ),
              ),
            ]),
            const SizedBox(height: 2),
            Text(
                'Buy now, pay within ${_ci(a['termsDays'])} days. '
                'Up to ${_ugx(_ci(a['limit']))}.',
                style: _txt(12.5, color: _mid)),
            const SizedBox(height: 12),
            Row(children: [
              fig(_ci(a['owed']) < 0 ? 'In advance' : 'You owe',
                  _shortUgx(_ci(a['owed']).abs())),
              const SizedBox(width: 6),
              fig('Left to use', _shortUgx(_ci(a['available'])),
                  colour: _green),
              const SizedBox(width: 6),
              fig('Late', _ci(a['overdue']) > 0 ? _shortUgx(_ci(a['overdue'])) : 'Nothing',
                  colour: _ci(a['overdue']) > 0 ? _ember : _green),
            ]),

            if (bills.isNotEmpty) ...[
              heading('BILLS NOT YET PAID'),
              for (final b in bills)
                Container(
                  margin: const EdgeInsets.only(bottom: 6),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                  decoration: BoxDecoration(
                    color: _white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                        color: '${b['due']}'.compareTo(today) < 0
                            ? _ember.withOpacity(0.4)
                            : _hairline),
                  ),
                  child: Row(children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(_creditDay('${b['date']}'),
                              style: _txt(12.5,
                                  weight: FontWeight.w700, color: _ink)),
                          Text(
                              '${b['due']}'.compareTo(today) < 0
                                  ? 'Late since ${_creditDay('${b['due']}')}'
                                  : 'Pay by ${_creditDay('${b['due']}')}',
                              style: _txt(11.5,
                                  color: '${b['due']}'.compareTo(today) < 0
                                      ? _ember
                                      : _mid)),
                        ],
                      ),
                    ),
                    Text(_ugx(_ci(b['left'])),
                        style: _txt(13, weight: FontWeight.w800, color: _ink)),
                  ]),
                ),
            ],

            heading('EVERY LINE'),
            Container(
              decoration: BoxDecoration(
                color: _white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: _hairline),
              ),
              child: Column(children: [
                for (var i = 0; i < lines.length; i++)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                    decoration: BoxDecoration(
                      border: i == lines.length - 1
                          ? null
                          : const Border(bottom: BorderSide(color: _hairline)),
                    ),
                    child: Row(children: [
                      Container(
                        width: 30,
                        height: 30,
                        decoration: BoxDecoration(
                          color: _ci(lines[i]['credit']) > 0 ? _greenPale : _amberPale,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                            _ci(lines[i]['credit']) > 0
                                ? Icons.south_west_rounded
                                : Icons.north_east_rounded,
                            size: 15,
                            color: _ci(lines[i]['credit']) > 0 ? _green : _amber),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('${lines[i]['what']}',
                                style: _txt(12.5,
                                    weight: FontWeight.w700, color: _ink)),
                            Text(
                                [
                                  _creditDay('${lines[i]['date']}'),
                                  if (lines[i]['orderNo'] != null) '${lines[i]['orderNo']}',
                                  if (lines[i]['ref'] != null) '${lines[i]['ref']}',
                                ].join(' · '),
                                style: _txt(11, color: _mid)),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                              _ci(lines[i]['credit']) > 0
                                  ? '-${_ugx(_ci(lines[i]['credit']))}'
                                  : '+${_ugx(_ci(lines[i]['debit']))}',
                              style: _txt(12.5,
                                  weight: FontWeight.w800,
                                  color: _ci(lines[i]['credit']) > 0
                                      ? _green
                                      : _ink)),
                          Text('Owed ${_shortUgx(_ci(lines[i]['balance']))}',
                              style: _txt(10.5, color: _light)),
                        ],
                      ),
                      // A payment has its own receipt to download.
                      if (lines[i]['kind'] == 'payment' && lines[i]['ref'] != null)
                        IconButton(
                          tooltip: 'Receipt',
                          visualDensity: VisualDensity.compact,
                          onPressed: () => _openDoc(context, 'receipt', '${lines[i]['ref']}', download: true),
                          icon: const Icon(Icons.receipt_long_outlined, size: 18, color: _brand),
                        ),
                    ]),
                  ),
              ]),
            ),

            heading('HOW TO PAY'),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _brandPale,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                  'Pay at the shop counter in cash, Mobile Money or bank. '
                  'The cashier gives you a receipt and you get an SMS. '
                  'Your oldest bill is paid first.',
                  style: _txt(12.5, color: _inkSoft, height: 1.45)),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  THE CUSTOMER'S ACCOUNT PAGE
//
//  Who they are, their credit (what they owe, the limit, what is late,
//  what to pay to buy more), what came in and went out this month, the
//  latest lines, their shopping, and their details.
// ═══════════════════════════════════════════════════════════════

class _CustomerHome extends StatefulWidget {
  const _CustomerHome({required this.onProfile});
  final VoidCallback onProfile;

  @override
  State<_CustomerHome> createState() => _CustomerHomeState();
}

class _CustomerHomeState extends State<_CustomerHome> {
  Map<String, dynamic>? _me;
  Map<String, dynamic>? _credit;
  List<Map<String, dynamic>> _orders = const [];
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    Map<String, dynamic>? me, credit;
    var orders = const <Map<String, dynamic>>[];
    try {
      me = ((await _apiGet('/api/auth/me'))['user'] as Map?)?.cast<String, dynamic>();
    } on _ApiError {/* keep what the phone knows */}
    try {
      credit = await _apiGet('/api/me/credit');
    } on _ApiError {/* no credit, or an older shop */}
    try {
      orders = (((await _apiGet('/api/orders/mine'))['orders'] as List?) ?? const [])
          .map((x) => (x as Map).cast<String, dynamic>())
          .toList();
    } on _ApiError {/* shown as nothing yet */}
    if (!mounted) return;
    setState(() {
      _me = me;
      _credit = credit;
      _orders = orders;
      _loaded = true;
    });
  }

  void _openCredit() => showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        backgroundColor: Colors.transparent,
        builder: (_) => _CreditSheet(data: _credit!),
      );

  Widget _box({required Widget child, EdgeInsets? padding, Color? color, Color? border}) =>
      Container(
        width: double.infinity,
        padding: padding ?? const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: color ?? _white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: border ?? _hairline),
        ),
        child: child,
      );

  Widget _heading(String t, {String? action, VoidCallback? onAction}) => Padding(
        padding: const EdgeInsets.fromLTRB(2, 18, 2, 8),
        child: Row(children: [
          Text(t, style: _txt(11.5, weight: FontWeight.w800, color: _light)),
          const Spacer(),
          if (action != null)
            GestureDetector(
              onTap: onAction,
              child: Text(action,
                  style: _txt(12.5, weight: FontWeight.w700, color: _brand)),
            ),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    final s = _Session();
    final me = _me ?? s.user ?? const {};
    final name = '${me['fullName'] ?? s.fullName}'.trim();
    final initials = name.isEmpty
        ? '?'
        : name.split(RegExp(r'\s+')).take(2).map((w) => w.characters.first.toUpperCase()).join();
    final a = (_credit?['account'] as Map?)?.cast<String, dynamic>();
    final lines = ((_credit?['statement'] as List?) ?? const [])
        .map((x) => (x as Map).cast<String, dynamic>())
        .toList();
    final live = _orders
        .where((o) => !const ['cancelled', 'rejected', 'refunded'].contains('${o['status']}'))
        .toList();
    final spent = live.fold<int>(0, (n, o) => n + _ci(o['total']));
    final open = live.where((o) => '${o['status']}' != 'released').length;

    return RefreshIndicator(
      color: _brand,
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 24),
        children: [
          // ── Who they are ───────────────────────────────────────────
          _box(
            child: Row(children: [
              Container(
                width: 54,
                height: 54,
                alignment: Alignment.center,
                decoration: const BoxDecoration(color: _lime, shape: BoxShape.circle),
                child: Text(initials,
                    style: _title(19, weight: FontWeight.w800, color: _onLime)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name.isEmpty ? 'Customer' : name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: _title(17, weight: FontWeight.w800)),
                    const SizedBox(height: 2),
                    Text('${me['phone'] ?? s.phone}', style: _txt(12.5, color: _mid)),
                    if ('${me['memberSince'] ?? ''}'.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text('Customer since ${_creditDay('${me['memberSince']}')}',
                          style: _txt(11.5, color: _light)),
                    ],
                  ],
                ),
              ),
              _Pressable(
                scale: 0.9,
                onTap: widget.onProfile,
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: _tile,
                    shape: BoxShape.circle,
                    border: Border.all(color: _hairline),
                  ),
                  child: const Icon(Icons.settings_outlined, size: 18, color: _mid),
                ),
              ),
            ]),
          ),

          if (!_loaded)
            const Padding(
              padding: EdgeInsets.all(30),
              child: Center(child: CircularProgressIndicator(strokeWidth: 2, color: _brand)),
            ),

          // ── Credit ─────────────────────────────────────────────────
          if (a != null) ..._creditPart(a, lines) else if (_loaded) ..._noLoan(),

          // ── Shopping ───────────────────────────────────────────────
          if (_loaded) ...[
            _heading('MY SHOPPING'),
            Row(children: [
              _figure('Orders', '${_orders.length}', Icons.receipt_long_outlined),
              const SizedBox(width: 8),
              _figure('Spent', _shortUgx(spent), Icons.payments_outlined),
              const SizedBox(width: 8),
              _figure('Open now', '$open', Icons.local_shipping_outlined),
            ]),
          ],

          // ── Details ────────────────────────────────────────────────
          _heading('MY DETAILS'),
          _box(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            child: Column(children: [
              _detail(Icons.person_outline_rounded, 'Account', switch (s.accountType) {
                'company_owner' => 'Company owner',
                'company_staff' => 'Company buyer',
                _ => 'Individual',
              }),
              if (s.isCompany) _detail(Icons.business_rounded, 'Company', s.companyName),
              if (s.staffRole != null) _detail(Icons.badge_outlined, 'Role', s.staffRole!),
              _detail(Icons.account_balance_wallet_outlined, 'Limit per order',
                  s.spendingLimit == null ? 'No limit' : _ugx(s.spendingLimit!)),
              if ('${me['email'] ?? ''}'.isNotEmpty && !'${me['email']}'.endsWith('.invalid'))
                _detail(Icons.mail_outline_rounded, 'Email', '${me['email']}'),
              _detail(Icons.storefront_outlined, 'Shop', 'Al Hadeed Hardware, Kampala', last: true),
            ]),
          ),
          if (s.accountType == 'company_staff') ...[
            const SizedBox(height: 10),
            _box(
              color: _bluePale,
              border: _bluePale,
              child: Text(
                  'Every order you place is in ${s.companyName}\'s name, and the owner can see it.',
                  style: _txt(12.5, color: _inkSoft, height: 1.45)),
            ),
          ],

          // ── Help ───────────────────────────────────────────────────
          _heading('HELP'),
          _box(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
            child: Column(children: [
              _link(Icons.privacy_tip_outlined, 'Privacy policy',
                  () => launchURL('https://alhaheed-hardware.vercel.app/privacy')),
              const Divider(height: 1, color: _hairline),
              _link(Icons.settings_outlined, 'Account and sign out', widget.onProfile),
              const Divider(height: 1, color: _hairline),
              _link(Icons.person_remove_outlined, 'Delete my account',
                  () => _DeleteAccountSheet.open(context),
                  colour: _ember),
            ]),
          ),
        ],
      ),
    );
  }

  List<Widget> _creditPart(Map<String, dynamic> a, List<Map<String, dynamic>> lines) {
    final owed = _ci(a['owed']);
    final limit = _ci(a['limit']);
    final late = _ci(a['overdue']);
    final over = owed - limit;
    final used = limit > 0 ? owed / limit : 1.0;
    final status = '${a['status']}';
    final stopped = status == 'hold' || status == 'closed';
    // What to pay before anything more can go on credit.
    final payNow = [0, late, over].reduce((x, y) => x > y ? x : y);
    final (label, tone, pale) = stopped
        ? ('Stopped', _ember, _emberPale)
        : over > 0
            ? ('Over limit', _ember, _emberPale)
            : late > 0
                ? ('Late', _amber, _amberPale)
                : used >= 0.8
                    ? ('Near limit', _amber, _amberPale)
                    : ('Good', _green, _greenPale);

    final month = DateTime.now().toIso8601String().substring(0, 7);
    final thisMonth = lines.where((l) => '${l['date']}'.startsWith(month));
    final bought = thisMonth.fold<int>(0, (n, l) => n + _ci(l['debit']));
    final paid = thisMonth.fold<int>(0, (n, l) => n + _ci(l['credit']));

    return [
      _heading('MY LOAN', action: 'Statement', onAction: _openCredit),
      // The big card: what they owe against the limit.
      _Pressable(
        scale: 0.99,
        onTap: _openCredit,
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
          decoration: BoxDecoration(
            color: _navy,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Container(
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(
                    color: _lime.withOpacity(0.18),
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: const Icon(Icons.account_balance_wallet_rounded, size: 17, color: _lime),
                ),
                const SizedBox(width: 9),
                Text('Loan account',
                    style: _txt(13, weight: FontWeight.w700, color: _white)),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                  decoration: BoxDecoration(color: pale, borderRadius: BorderRadius.circular(20)),
                  child: Text(label, style: _txt(11, weight: FontWeight.w800, color: tone)),
                ),
              ]),
              const SizedBox(height: 14),
              Text(owed < 0 ? 'Paid in advance' : 'Your loan (debit)',
                  style: _txt(12, color: _white.withOpacity(0.65))),
              const SizedBox(height: 2),
              Text(_ugx(owed.abs()),
                  style: _title(28, weight: FontWeight.w800, color: _white)),
              const SizedBox(height: 14),
              // Used of the limit; the part past it shows red.
              LayoutBuilder(builder: (_, c) {
                final w = c.maxWidth;
                final inLimit = (used.clamp(0.0, 1.0)) * w;
                return Stack(children: [
                  Container(
                    height: 9,
                    decoration: BoxDecoration(
                      color: _white.withOpacity(0.14),
                      borderRadius: BorderRadius.circular(5),
                    ),
                  ),
                  Container(
                    width: inLimit,
                    height: 9,
                    decoration: BoxDecoration(
                      color: over > 0 ? _ember : (used >= 0.8 ? const Color(0xFFE0A030) : _lime),
                      borderRadius: BorderRadius.circular(5),
                    ),
                  ),
                ]);
              }),
              const SizedBox(height: 7),
              Row(children: [
                Text('${(used * 100).clamp(0, 999).round()}% of your limit',
                    style: _txt(11.5, color: _white.withOpacity(0.7))),
                const Spacer(),
                Text('Limit ${_ugx(limit)}',
                    style: _txt(11.5, weight: FontWeight.w700, color: _white.withOpacity(0.85))),
              ]),
              const SizedBox(height: 14),
              Row(children: [
                _darkFigure('Left to use', _shortUgx(_ci(a['available'])),
                    _ci(a['available']) > 0 ? _lime : _white.withOpacity(0.5)),
                _darkFigure('Late', late > 0 ? _shortUgx(late) : 'Nothing',
                    late > 0 ? const Color(0xFFFF8A80) : _lime),
                _darkFigure('Days to pay', '${_ci(a['termsDays'])}', _white),
              ]),
            ],
          ),
        ),
      ),

      // What to do about it.
      if (stopped) ...[
        const SizedBox(height: 10),
        _alert(Icons.block_rounded, _ember, _emberPale,
            'Loan is stopped', 'You cannot take goods on loan now. Please see the shop.'),
      ] else if (payNow > 0) ...[
        const SizedBox(height: 10),
        _alert(
          Icons.priority_high_rounded,
          _ember,
          _emberPale,
          'Pay ${_ugx(payNow)} to take more on loan',
          [
            if (over > 0) 'You are ${_ugx(over)} over your limit.',
            if (late > 0) '${_ugx(late)} is past the ${_ci(a['termsDays'])} days.',
            'Pay at the shop counter. You get a receipt and an SMS.',
          ].join(' '),
        ),
      ] else if (a['nextDue'] != null) ...[
        const SizedBox(height: 10),
        _alert(Icons.event_rounded, _green, _greenPale, 'All good',
            'Next bill is due ${_creditDay('${a['nextDue']}')}.'),
      ],

      // This month: what went on credit, what was paid.
      const SizedBox(height: 10),
      Row(children: [
        Expanded(
          child: _flow('Taken on loan this month', 'Debit', bought, Icons.north_east_rounded, _amber, _amberPale),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _flow('Paid back this month', 'Paid', paid, Icons.south_west_rounded, _green, _greenPale),
        ),
      ]),

      // The latest lines.
      _heading('LATEST', action: lines.length > 4 ? 'See all' : null, onAction: _openCredit),
      _box(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
        child: lines.isEmpty
            ? Padding(
                padding: const EdgeInsets.all(12),
                child: Text('Nothing yet.', style: _txt(12.5, color: _mid)),
              )
            : Column(children: [
                for (var i = 0; i < lines.length && i < 4; i++) ...[
                  if (i > 0) const Divider(height: 1, color: _hairline),
                  _line(lines[i]),
                ],
              ]),
      ),
    ];
  }

  /// No loan open yet: the same card, at zero, and how to get one.
  List<Widget> _noLoan() => [
        _heading('MY LOAN'),
        Container(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
          decoration: BoxDecoration(
            color: _navy,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Container(
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(
                    color: _lime.withOpacity(0.18),
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: const Icon(Icons.account_balance_wallet_rounded, size: 17, color: _lime),
                ),
                const SizedBox(width: 9),
                Text('Loan account',
                    style: _txt(13, weight: FontWeight.w700, color: _white)),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                  decoration: BoxDecoration(
                      color: _white.withOpacity(0.14), borderRadius: BorderRadius.circular(20)),
                  child: Text('Not open',
                      style: _txt(11, weight: FontWeight.w800, color: _white)),
                ),
              ]),
              const SizedBox(height: 14),
              Text('Your loan (debit)', style: _txt(12, color: _white.withOpacity(0.65))),
              const SizedBox(height: 2),
              Text(_ugx(0), style: _title(28, weight: FontWeight.w800, color: _white)),
              const SizedBox(height: 14),
              Container(
                height: 9,
                decoration: BoxDecoration(
                  color: _white.withOpacity(0.14),
                  borderRadius: BorderRadius.circular(5),
                ),
              ),
              const SizedBox(height: 14),
              Row(children: [
                _darkFigure('Limit', 'None', _white.withOpacity(0.6)),
                _darkFigure('Debit', _shortUgx(0), _white),
                _darkFigure('Paid', _shortUgx(0), _lime),
              ]),
            ],
          ),
        ),
        const SizedBox(height: 10),
        _alert(Icons.info_outline_rounded, _blue, _bluePale, 'No loan yet',
            'Want to take goods now and pay later? Ask the shop to open a loan for you.'),
      ];

  Widget _darkFigure(String k, String v, Color c) => Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(k, style: _txt(10.5, color: _white.withOpacity(0.6))),
            const SizedBox(height: 2),
            Text(v, style: _txt(14, weight: FontWeight.w800, color: c)),
          ],
        ),
      );

  Widget _alert(IconData icon, Color tone, Color bg, String title, String text) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: tone.withOpacity(0.25)),
        ),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(color: tone, shape: BoxShape.circle),
            child: Icon(icon, size: 16, color: _white),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: _txt(13.5, weight: FontWeight.w800, color: tone)),
                const SizedBox(height: 2),
                Text(text, style: _txt(12, color: _inkSoft, height: 1.4)),
              ],
            ),
          ),
        ]),
      );

  Widget _flow(String k, String tag, int v, IconData icon, Color tone, Color pale) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: _white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: _hairline),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(color: pale, shape: BoxShape.circle),
                child: Icon(icon, size: 14, color: tone),
              ),
              const Spacer(),
              Text(tag, style: _txt(10.5, weight: FontWeight.w700, color: tone)),
            ]),
            const SizedBox(height: 8),
            Text(_shortUgx(v), style: _title(17, weight: FontWeight.w800)),
            Text(k, style: _txt(11.5, color: _mid)),
          ],
        ),
      );

  Widget _line(Map<String, dynamic> l) {
    final paid = _ci(l['credit']) > 0;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 9),
      child: Row(children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(color: paid ? _greenPale : _amberPale, shape: BoxShape.circle),
          child: Icon(paid ? Icons.south_west_rounded : Icons.north_east_rounded,
              size: 15, color: paid ? _green : _amber),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${l['what']}', style: _txt(13, weight: FontWeight.w700, color: _ink)),
              Text(
                  [
                    _creditDay('${l['date']}'),
                    if (l['orderNo'] != null) '${l['orderNo']}',
                  ].join(' · '),
                  style: _txt(11, color: _mid)),
            ],
          ),
        ),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Text(paid ? '-${_ugx(_ci(l['credit']))}' : '+${_ugx(_ci(l['debit']))}',
              style: _txt(13, weight: FontWeight.w800, color: paid ? _green : _ink)),
          Text('Owed ${_shortUgx(_ci(l['balance']))}', style: _txt(10.5, color: _light)),
        ]),
      ]),
    );
  }

  Widget _figure(String k, String v, IconData icon) => Expanded(
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: _white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: _hairline),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 17, color: _brand),
              const SizedBox(height: 6),
              Text(v,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: _title(16, weight: FontWeight.w800)),
              Text(k, style: _txt(11, color: _mid)),
            ],
          ),
        ),
      );

  Widget _detail(IconData icon, String k, String v, {bool last = false}) => Container(
        padding: const EdgeInsets.symmetric(vertical: 11),
        decoration: BoxDecoration(
          border: last ? null : const Border(bottom: BorderSide(color: _hairline)),
        ),
        child: Row(children: [
          Icon(icon, size: 17, color: _mid),
          const SizedBox(width: 10),
          Text(k, style: _txt(13, color: _mid)),
          const SizedBox(width: 12),
          Expanded(
            child: Text(v,
                textAlign: TextAlign.right,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: _txt(13, weight: FontWeight.w600, color: _ink)),
          ),
        ]),
      );

  Widget _link(IconData icon, String label, VoidCallback onTap, {Color colour = _ink}) => _Pressable(
        scale: 0.98,
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Row(children: [
            Icon(icon, size: 18, color: colour == _ink ? _brand : colour),
            const SizedBox(width: 10),
            Expanded(child: Text(label, style: _txt(13.5, weight: FontWeight.w600, color: colour))),
            const Icon(Icons.chevron_right_rounded, size: 18, color: _light),
          ]),
        ),
      );
}

// ═══════════════════════════════════════════════════════════════
//  DOCUMENTS — order summary, receipts and the loan statement, as PDF
// ═══════════════════════════════════════════════════════════════

/// Asks the shop for a link to one of the customer's own documents and
/// opens it. The phone's browser shows the PDF, with Download, Share and
/// Print. The link works for ten minutes only.
Future<void> _openDoc(BuildContext context, String type, String id,
    {bool download = false}) async {
  try {
    final r = await _apiGet(
        '/api/docs/link?type=$type&id=${Uri.encodeQueryComponent(id)}');
    final url = '${r['url']}';
    await launchURL(download ? '$url&download=1' : url);
  } on _ApiError catch (e) {
    if (context.mounted) _toast(context, e.message, bad: true);
  }
}

Widget _docButton(IconData icon, String label, String note, VoidCallback onTap,
        {VoidCallback? onPrint}) =>
    _Pressable(
      scale: 0.98,
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.fromLTRB(12, 10, 8, 10),
        decoration: BoxDecoration(
          color: _white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: _hairline),
        ),
        child: Row(children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
                color: _brandPale, borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, size: 19, color: _brand),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(label,
                  style: _txt(13.5, weight: FontWeight.w700, color: _ink)),
              Text(note,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: _txt(11.5, color: _mid)),
            ]),
          ),
          if (onPrint != null)
            IconButton(
              tooltip: 'Print',
              onPressed: onPrint,
              icon: const Icon(Icons.print_outlined, size: 20, color: _inkSoft),
            ),
          const Icon(Icons.download_rounded, size: 20, color: _brand),
          const SizedBox(width: 4),
        ]),
      ),
    );
